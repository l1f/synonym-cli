#!/usr/bin/env node

const { Input, Select, Confirm } = require('enquirer')
const axios = require('axios')
const clipboard = require('clipboardy')
const chalk = require('chalk')
const columns = require('cli-columns')

const YAML = require('yamljs')
const XML = { stringify: require('json2xml') }
const CSV = { stringify: (data, seperator) => data.join(seperator) }
const TEXT = { stringify: data => columns(data.map()) }

const PATTERN = /[a-zäöü]+/i

const URL = 'https://www.openthesaurus.de/synonyme/search?format=application/json&q='

async function main() {
    let argvPointer = 2

    if(process.argv.length === 2 && !(process.argv[1].endsWith('index.js') || process.argv[1].endsWith('/synonym')))
        argvPointer = 1

    let word = process.argv[argvPointer]
    if(!PATTERN.test(word)) {
        console.log(chalk.redBright.bold(`\nBitte nur Wörter angeben.\n`))
        process.exit(1)
    }

    while (word === undefined || word === '') {
        const wordInput = new Input({
            name: 'word',
            message: 'Zu welchem Wort suchst Du die Synonyme?'
        })

        word = await wordInput.run()
    }

    word = word.toLowerCase()

    axios.get(URL + encodeURIComponent(word)).then(response => {
        return response.data
    }).then(responseData => {
        const synsets = responseData.synsets

        if (synsets.length === 0) {
            console.log(chalk.redBright.bold(`\nKeine Synonyme für '${word}' gefunden.\n`))
            process.exit(1)
        }

        const outputTypeSelect = new Select({
            name: 'outputType',
            message: 'In welchem Format hättest Du die Synonyme gerne?',
            choices: ['json', 'csv', 'yml', 'xml', 'text']
        })

        outputTypeSelect.run().then(async outputType => {
            let csvSeperator = ';'

            if (outputType === 'csv') {
                const csvSeperatorInput = new Input({
                    name: 'seperator',
                    message: 'Bitte gebe einen Seperator für die einzelnen Daten ein',
                    initial: '\\n'
                })

                csvSeperator = await csvSeperatorInput.run()
                if (csvSeperator === '\\n') csvSeperator = '\n'

            }

            const meanings = synsets.map((synset, index) => {
                if (synset.categories.length > 0)
                    return { message: synset.categories[0], value: index.toString() }
                return { message: synset.terms.slice(0, 2).map(term => term.term).join(', '), value: index.toString() }
            })

            const wordMeaningSelect = new Select({
                name: 'wordMeaning',
                message: 'Welche dieser folgenden Terme / Kategorien beschreibt Dein Wort am besten?',
                scroll: false,
                choices: meanings
            })

            wordMeaningSelect.run().then(wordMeaningIndex => {

                let data = synsets[wordMeaningIndex].terms.map(term => term.term)

                switch (outputType) {
                    case 'json':
                        data = JSON.stringify(data, null, 4)
                        break
                    case 'csv':
                        data = CSV.stringify(data, csvSeperator)
                        break
                    case 'yml':
                        data = YAML.stringify(data)
                        break
                    case 'xml':
                        data = XML.stringify(data.map(d => { return { synonym: d } }), { header: true })
                        break
                    case 'text':
                        data = columns(data)
                        break
                    default:
                        break
                }

                clipboard.writeSync(data)
                console.log(chalk.gray.bold.bgYellow('\nIn die Zwischenablage kopiert\n'))

            }).catch(console.error)

        }).catch(console.error)

    }).catch(console.error)

}

main()