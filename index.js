'use strict'

const EventEmitter = require('events').EventEmitter
const Parser = require('node-expat').Parser

class XMLStream extends EventEmitter {
  constructor (stream, options) {
    super()
    options = options || {}
    this.encoding = options.encoding || 'UTF-8'
    this.stream = stream
    this.parser = new Parser(this.encoding)
    this.stream.pipe(this.parser)
    this.explicitText = options.explicitText
    this.explicitArrays = options.explicitArrays
    this.disableAutotrim = options.disableAutotrim
    this._attachEvents()
    this._root = {}
    this._elementTree = [{
      isRoot: true,
      element: this._root,
      children: null
    }]
  }

  _attachEvents () {
    const stream = this.stream
    const parser = this.parser
    stream.on('error', this._handleError.bind(this))
    parser.on('error', this._handleError.bind(this))
    parser.on('close', this._handleClose.bind(this))
    parser.on('startElement', this._handleStartElement.bind(this))
    parser.on('endElement', this._handleEndElement.bind(this))
    parser.on('text', this._handleText.bind(this))
    parser.on('end', this._handleEnd.bind(this))
  }

  _handleEnd () {
    this.emit('end', this._root)
  }

  _handleClose () {
    this.emit('close')
  }

  _handleError (err) {
    // We are only emitting one error.
    if (this._errored) return
    this._errored = true
    this.emit('error', err)
    this.parser.destroy()
  }

  _getLastElementFromTree () {
    const tree = this._elementTree
    return tree[tree.length - 1]
  }

  _handleStartElement (name, attrs) {
    const newElement = {
      $: attrs
    }

    const parent = this._getLastElementFromTree()

    this._elementTree.push({
      isRoot: false,
      element: newElement,
      children: [],
      parent: parent,
      name: name
    })

    const current = this._getLastElementFromTree()

    if (!parent.isRoot) {
      if (!parent.element[name]) {
        parent.element[name] = []
        parent.children.push(name)
      }
      let newLen = parent.element[name].push(newElement)
      current.childIndex = newLen - 1
    } else {
      this._root[name] = newElement
    }
  }

  _handleEndElement (endName) {
    const oldElement = this._elementTree.pop()
    const name = oldElement.name
    const children = oldElement.children
    const parent = oldElement.parent
    const childIndex = oldElement.childIndex
    let el = oldElement.element

    if (name !== endName) {
      return this._handleError(new Error(`parser ended element '${endName}', which is not the element we are building ('${name}')`))
    }

    if (!this.explicitArrays) {
      for (let i = 0; i < children.length; i++) {
        let child = children[i]
        if (el[child].length === 1) {
          el[child] = el[child][0]
        }
      }
    }

    if (el._ && !this.disableAutotrim) {
      el._ = el._.trim()
    }
    
    if (!el._ || el._ === '') delete el._

    if (!this.explicitText) { // $@#%*!!!!
      let hasProps = false
      for (let a in el.$) {
        if (el.$.hasOwnProperty(a)) {
          hasProps = true
          break
        }
      }
      if (!hasProps && !children.length) {
        el = el._ || null // Otherwise, it's 'undefined'.
        // We also need to set this child on the parent.
        if (!parent.isRoot) {
          parent.element[name][childIndex] = el
        }
      }
    }

    this.emit('element', el, name)
    this.emit('element: ' + name, el, name)
  }

  _handleText (text) {
    const curel = this._getLastElementFromTree().element
    curel._ = curel._ || ''
    curel._ += text
  }

  pause () {
    this.stream.pause()
  }

  resume () {
    this.stream.resume()
  }
}

module.exports = XMLStream
