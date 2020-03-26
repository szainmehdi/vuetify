// Utilities

const fs = require('fs')
const path = require('path')
const resolve = file => path.resolve(__dirname, file)
const marked = require('marked')
const { camelCase, upperCase } = require('lodash')

marked.setOptions({
  headerIds: false,
})

function parse (type, lang, value) {
  return { type, lang, value }
}

function getNodeType (node) {
  switch (true) {
    case node.startsWith('<br>'): return 'break'
    case node.startsWith('#'): return 'heading'
    case node.startsWith('>'): return 'alert'
    case node.startsWith('<'): return 'comment'
    case node.startsWith('**'): return 'component'
    case node.startsWith('`'): return 'snippet'
    case node.startsWith('!'): return 'img'
    case node.startsWith(' '): return ''
    default: return 'text'
  }
}

function getLineMethod (node) {
  switch (getNodeType(node)) {
    case 'alert': return parseAlert
    case 'component': return parseComponent
    case 'heading': return parseHeading
    case 'img': return parseImg
    case 'snippet': return parseSnippet
    case 'text': return parseText
    default: return () => {}
  }
}

function parseAlert (index, page) {
  const node = page[index]

  const [value, lang] = node
    .replace(/>/, '')
    .split(' ')

  return parse('alert', camelCase(lang), value)
}

function parseComponent (index, page) {
  const node = page[index]
  const values = []

  for (const line of page.slice(index + 1)) {
    if (!line.startsWith('  * ')) break

    values.push(line.replace('  * ', ''))
  }

  return parse(node.replace(/\*\*/g, ''), undefined, values)
}

function parseHeading (index, page) {
  const node = page[index]
  const [, lang] = node.split(' ')

  return parse('heading', camelCase(lang))
}

function parseImg (index, page) {
  const node = page[index]
  const regexp = new RegExp(/!\[(.*)\]\((.*)\)/)

  const [lang, value] = node.match(regexp).slice(1, 3)

  return parse('img', camelCase(lang), value)
}

function parseSnippet (index, page) {
  const lines = page.slice(index, index + 3)
  const values = []

  for (const line of lines) {
    const l = line
      .replace(/```/, '')
      .replace(/-/g, '_')
      .trim()

    l && values.push(l)
  }

  const value = values.join('_')

  return parse('markup', undefined, value)
}

function parseText (index, page) {
  const node = page[index]
  const text = camelCase(node)

  return parse('text', text)
}

function genSection (children = []) {
  return {
    type: 'section',
    children,
  }
}

function isHeading (node) {
  return getNodeType(node) === 'heading'
}

function isBreak (node) {
  return getNodeType(node) === 'break'
}

function parseLine (index, page) {
  const node = page[index]
  console.log(node + '\n\n\n')

  return getLineMethod(node)(index, page)
}

function shouldParse (line) {
  return (
    line &&
    !isBreak(line) &&
    line !== '```' &&
    !line.startsWith(' ')
  )
}

module.exports = function (content) {
  this.cacheable()

  const page = content.split('\n')
    .filter(v => v)

  const output = []
  let children = []

  for (const index in page) {
    const line = page[index]

    if (!shouldParse(line)) continue

    const parsed = parseLine(index, page)

    // Push regular lines
    if (isHeading(line) || isBreak(line)) {
      children.length && output.push(
        genSection(children)
      )

      children = []
    }

    children.push(parsed)
  }

  children.length && output.push(
    genSection(children)
  )

  const json = { children: output }

  return 'module.exports = ' + JSON.stringify(json, null, 2)
}
