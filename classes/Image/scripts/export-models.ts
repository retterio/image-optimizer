/* eslint-disable unicorn/no-null */
/* eslint-disable unicorn/prefer-module */
/* eslint-disable import/no-unresolved */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { zodToJsonSchema } from 'zod-to-json-schema'
import fs from 'fs'
import path from 'path'
import { ZodType } from 'zod'
import { removeImageInput, uploadInput } from '../types'

const modelExporter = (t: ZodType<any>, name: string) => {
  const r = zodToJsonSchema(t, { name, $refStrategy: 'none' })
  fs.writeFileSync(path.join(__dirname, '..', '..', '..', 'models', `${name}.json`), JSON.stringify(r.definitions[name], null, 4))
}

modelExporter(uploadInput, 'UploadInput')
modelExporter(removeImageInput, 'RemoveInput')
