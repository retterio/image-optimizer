import RDK, { Data, OperationResponse, StepResponse } from '@retter/rdk'
import sharp from 'sharp'
import { ResizedImageParameters, resizedImageParameters, RemoveImageInput, UploadInput, ParsedPath } from './types'
import { v4 as uuidv4 } from 'uuid';

const rdk = new RDK()

const imagePrefix = 'IMAGE_'
const defaultImage = 'defaultImage'

const qualities: Record<string, number> = {
    default: 25,
    high: 100,
    medium: 50,
    low: 15,
}

const getResizedImage = async ({ 
        height, width, quality, content, fit 
    } : ResizedImageParameters): Promise<Buffer> => {
    const image = await sharp(content)
        .resize(width, height, {
            fit,
        })
        .toFormat('png', { quality: qualities[quality] })
        .toBuffer()

    return image
}

const parsePath = (path: string): ParsedPath => {
    // Get path
    const fullPath = path.split('/')[1]
    // Get before "." and split it every "_"
    const ids = fullPath.split('.')[0].split('_')
    if (ids.length < 2 || ids.length > 4 || !fullPath.includes('.')) {
        throw new Error('Invalid image path')
    }

    const quality = ids.length > 2 ? ids[2] : undefined
    const fit = ids.length > 3 ? ids[3] : undefined
    const parameterObject = {
        imageId: ids[0],
        width: ids[1].split('x')[0],
        height: ids[1].split('x')[1],
        quality,
        format: fullPath.split('.')[1],
        fit,
    }

    return parameterObject
}

/*
 ********************************
 ********************************
 ******    COS Methods     ******
 ********************************
 ********************************
 */

export async function get(data: Data): Promise<StepResponse> {
    try {
        let cacheDuration = 31_536_000 // 1 year

        const path = data.context.pathParameters.path

        if (!path) {
            throw new Error('Path does not exist')
        }

        const newPath = parsePath(path)

        let file = await rdk.getFile({
            filename: imagePrefix + newPath.imageId,
        })

        if (!file?.success) {
            file = await rdk.getFile({
                filename: imagePrefix + defaultImage,
            })
            cacheDuration = 900 // 15 min
        }

        if (!file?.success) throw new Error("Something went wrong while getting file!")

        const fileData: string = file.data
        const uri = fileData.split(';base64,').pop()
        const image = Buffer.from(uri, 'base64')

        const parameters: ResizedImageParameters = resizedImageParameters.parse({
            content: image,
            id: newPath.imageId,
            width: newPath.width,
            height: newPath.height,
            quality: newPath.quality,
            fit: newPath.fit,
        })

        const resizedImage = await getResizedImage(parameters)

        data.response = {
            statusCode: 200,
            body: resizedImage.toString("base64"),
            isBase64Encoded: true,
            headers: {
                "Content-Type": "image/jpg"
            }
        }
    } catch (error) {
        data.response = {
            statusCode: 400,
            body: error.message
        }
    }
    return data
}

export async function remove(data: Data): Promise<StepResponse> {
    try {
        const { imageId } = data.request.body as RemoveImageInput

        if (!imageId) throw new Error('Invalid remove request')

        const deleteFileResponse = await rdk.deleteFile({
            filename: imagePrefix + imageId,
        })

        if (!deleteFileResponse?.success) {
            throw new Error('Image file could not removed')
        }
        
        data.response = {
            statusCode: 200,
            body: {
                message: 'Image has been removed.',
            }
        }
    } catch (error) {
        data.response = {
            statusCode: 400,
            body: error.message
        }
    }
    return data
}

export async function upload(data: Data): Promise<StepResponse> {
    try {
        const { content } = data.request.body as UploadInput
        const projectId = data.context.projectId

        const imageId = uuidv4();
      
        if (Buffer.from(content, 'base64').toString('base64') !== content) {
            throw new Error('Content is not base-64 format')
        }

        const setFileResponse = await rdk.setFile({
            filename: imagePrefix + imageId,
            body: content,
        })

        if (!setFileResponse?.success) {
            throw new Error('Image could not be uploaded!')
        }

        data.response = {
            statusCode: 200,
            body: {
                message: 'Image has been uploaded',
                id: imageId,
                url: `https://api.a101prod.retter.io/${projectId}/CALL/Image/get/${imageId}_1024x1024_default_inside.png`
            },
        }
    } catch (error) {
        data.response = {
            statusCode: 400,
            body: error.message
        }
    }
    return data
}