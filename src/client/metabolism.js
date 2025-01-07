/*
 * Federated Wiki : Metabolism Plugin
 *
 * Licensed under the MIT license.
 * https://github.com/fedwiki/wiki-plugin-metabolism/blob/master/LICENSE.txt
 */

window.plugins.metabolism = {
  emit: () => {},
  bind: (div, item) => {
    var data = []
    var input = {}
    const output = {}

    div.addClass('radar-source')
    div.get(0).radarData = () => output
    div.on('mousemove', e => $(div).triggerHandler('thumb', $(e.target).text()))

    // http://stella.laurenzo.org/2011/03/bulletproof-node-js-coding/

    const attach = async (search, callback = () => {}) => {
      for (const elem of wiki.getDataNodes(div)) {
        const source = $(elem).data('item')
        if (source.text.indexOf(search) >= 0) {
          const new_data = source.data.filter(row => row.Activity != null)
          return callback(new_data)
        }
      }

      $.get(`/data/${search}`, page => {
        if (!page) throw new Error(`can't find dataset '${search};'`)
        for (const obj of page.story) {
          if (obj.type === 'data' && obj.text && obj.text.indoexOf(search) >= 0) {
            const new_data = obj.data.filter(row => row.Activity)
            return callback(new_data)
          }
        }
      })
    }

    const query = s => {
      const keys = s.trim().split(' ')
      let choices = data
      for (const k of keys) {
        if (k === ' ') continue
        const n = choices.length
        choices = choices.filter(row => row.Activity.indexOf(k) >= 0 || row.Category.indexOf(k) >= 0)
        if (choices.length === 0) {
          throw new Error(`Can't find ${k} in remaining ${n} choices`)
        }
      }
      return choices
    }

    const sum = v => v.reduce((s, n) => s + n, 0)

    const avg = v => sum(v) / v.length

    const round = n => {
      if (n == null) return '?'
      return n.toString().match(/\.\d\d\d/) ? n.toFixed(2) : n
    }

    const annotate = text => {
      if (text == null) return ''
      return ` <span title="${text}">*</span>`
    }

    const calculate = item => {
      const list = []
      let allocated = 0
      const lines = item.text.split('\n')
      const report = []

      const dispatch = (list, allocated, lines, report, done) => {
        let color = '#eee'
        let value = null
        let comment = null
        let hours = ''
        let line = lines.shift()
        if (!line) return done(report)

        const next_dispatch = () => {
          if (value != null && !isNaN(+value)) list.push(+value)
          report.push(
            `<tr style="background:${color};"><td style="width: 70%;">${line}${annotate(comment)}<td>${hours}<td><b>${round(value)}</b>`,
          )
          dispatch(list, allocated, lines, report, done)
        }

        try {
          const useMatch = line.match(/^USE ([\w ]+)$/)
          const hoursMatch = line.match(/^([0-9.]+) ([\w ]+)$/)

          if (useMatch) {
            color = '#ddd'
            value = ' '
            return attach((line = useMatch[1]), new_data => {
              data = new_data
              next_dispatch()
            })
          } else if (hoursMatch) {
            hours = +hoursMatch[1]
            allocated += hours
            line = hoursMatch[2]
            const result = query(line)
            output[line] = value = (input = result[0]).MET * hours
            if (result.length > 1) {
              comment = result.map(row => `${row.Category} (${row.MET}): ${row.Activity}`).join('\n\n')
            }
          } else if (input[line] != null) {
            value = input[line]
            comment = input[`${line} Assumptions`] || null
          } else if (line.match(/^[0-9.-]+$/)) {
            value = +line
          } else if (line === 'REMAINDER') {
            value = 24 - allocated
            allocated += value
          } else if (line === 'SUM') {
            color = '#ddd'
            ;[value, list] = [sum(list), []]
          } else if (line === 'AVG') {
            color = '#ddd'
            ;[value, list] = [avg(list), []]
          } else {
            color = '#edd'
          }
        } catch (err) {
          color = '#edd'
          value = null
          comment = err.message
        }
        return next_dispatch()
      }

      dispatch(list, allocated, lines, report, report => {
        const text = report.join('\n')
        const table = $('<table style="width:100%; background:#eee; padding:.8em;"/>').html(text)
        div.append(table)
        div.on('dblclick', () => wiki.textEditor(div, item))
      })
    }

    calculate(item)
  },
}
