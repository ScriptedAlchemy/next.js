/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Naoyuki Kanezawa @nkzawa
*/

'use strict'
/* tslint:disable */

import { API_ROUTE } from '../lib/constants'
import { isWriteable } from '../build/is-writeable'
import { stringify } from 'querystring'

const EntryOptionPlugin = require('webpack/lib/EntryOptionPlugin')
const EntryPlugin = require('webpack/lib/EntryPlugin')
const EntryDependency = require('webpack/lib/dependencies/EntryDependency')

const getNormalizedEntryStatic = entry => {
    if (typeof entry === "string") {
        return {
            main: {
                import: [entry]
            }
        };
    }
    if (Array.isArray(entry)) {
        return {
            main: {
                import: entry
            }
        };
    }
    /** @type {EntryStaticNormalized} */
    const result = {};
    for (const key of Object.keys(entry)) {
        const value = entry[key];
        if (typeof value === "string") {
            result[key] = {
                import: [value]
            };
        } else if (Array.isArray(value)) {
            result[key] = {
                import: value
            };
        } else {
            result[key] = {
                import:
                    value.import &&
                    (Array.isArray(value.import) ? value.import : [value.import]),
                filename: value.filename,
                dependOn:
                    value.dependOn &&
                    (Array.isArray(value.dependOn) ? value.dependOn : [value.dependOn]),
                library: value.library
            };
        }
    }
    return result;
};

class NextJsOnDemandEntries {
  constructor(context, entry) {
    this.context = context
    this.entry = entry
  }

  /**
   * @param {Compiler} compiler the compiler instance
   * @returns {void}
   */
  apply(compiler, {invalidator}) {

      compiler.hooks.compilation.tap(
        'NextJsOnDemandEntries',
        (compilation, { normalModuleFactory }) => {
          compilation.dependencyFactories.set(
            EntryDependency,
            normalModuleFactory
          )
        }
      )

      compiler.hooks.make.tapPromise(
        'NextJsOnDemandEntries',
        (compilation, callback) => {

          invalidator.startBuilding()


          /// no next.js stuff
          return Promise.resolve(this.entry())
            .then(denormalizedEntry => {
               const entry = getNormalizedEntryStatic(denormalizedEntry)
                console.log('normlaized', entry)
              const promises = []
              for (const name of Object.keys(entry)) {
                const desc = entry[name]
                const options = EntryOptionPlugin.entryDescriptionToOptions(
                  compiler,
                  name,
                  desc
                )

                for (const entry of desc.import) {
                  promises.push(
                    new Promise((resolve, reject) => {
                      compilation.addEntry(
                        this.context,
                        EntryPlugin.createDependency(entry, options),
                        options,
                        err => {
                          if (err) return reject(err)
                            console.log('entry added')
                          resolve()
                        }
                      )
                    })
                  )
                }
              }
              return Promise.all(promises)
            })
            .then(x => {})
        }
      )

  }
}

module.exports = NextJsOnDemandEntries
