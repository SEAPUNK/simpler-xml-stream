'use strict'

const {EventEmitter} = require('events')
const {Parser} = require('node-expat')

class XMLStream extends EventEmitter {
  constructor (stream, options = {}) {
    super()
    this.encoding = options.encoding || 'UTF-8'
    this.stream = stream
    this.parser = new Parser(this.encoding)
    this._attachEvents()
    this._root = {}
    this._elementTree = [this._root]
    this._elementNameTree = []
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

  _handleStartElement (name, attrs) {
    this._elementNameTree.push(name)
    if (this._currentElement) {
      this._elementTree.push(this._currentElement)
      if (!this._currentElement[name]) {
        this._currentElement[name] = []
      }
      const newEl = {
        $: attrs
      }
      this._currentElement[name].push(newEl)
      this._currentElement = newEl
    } else {
      this.root[name] = {
        $: attrs
      }
      const el = this.root[name]
      this._currentElement = el
    }
  }

  _handleEndELement (name) {
    if (this._elementNameTree.pop() !== name) {
      return this._handleError(new Error(`parser ended element '${name}', which is not the element we are building`))
    }
    const oldElement = this._currentElement
    this._currentElement = this._elementTree.pop()
    this.emit('element', oldElement)
  }

  _handleText (text) {
    const curel = this._currentElement
    curel.$text = curel.$text || ''
    curel.$text += text
  }

  pause () {
    this.stream.pause()
  }

  resume () {
    this.stream.resume()
  }
}

module.exports = XMLStream
