import { IncomingMessage, ServerResponse } from 'http'
import { ParsedUrlQuery } from 'querystring'
import {
  BUILD_MANIFEST,
  CLIENT_STATIC_FILES_PATH,
  REACT_LOADABLE_MANIFEST,
  SERVER_DIRECTORY,
} from '../lib/constants'
import { join } from 'path'
import { requirePage } from './require'
import { BuildManifest } from './get-page-files'
import { AppType, DocumentType } from '../lib/utils'
import { PageConfig, NextPageContext } from 'next/types'

export function interopDefault(mod: any) {
  return mod.default || mod
}

export type ManifestItem = {
  id: number | string
  name: string
  file: string
  publicPath: string
}

type ReactLoadableManifest = { [moduleId: string]: ManifestItem[] }

type Unstable_getStaticProps = (ctx: {
  params: ParsedUrlQuery | undefined
  preview?: boolean
  previewData?: any
}) => Promise<{
  props: { [key: string]: any }
  revalidate?: number | boolean
}>

export type Unstable_getStaticPaths = () => Promise<{
  paths: Array<string | { params: ParsedUrlQuery }>
}>

type Unstable_getServerProps = (context: {
  params: ParsedUrlQuery | undefined
  req: IncomingMessage
  res: ServerResponse
  query: ParsedUrlQuery
}) => Promise<{ [key: string]: any }>

export type LoadComponentsReturnType = {
  Component: React.ComponentType
  pageConfig?: PageConfig
  buildManifest: BuildManifest
  reactLoadableManifest: ReactLoadableManifest
  Document: DocumentType
  DocumentMiddleware?: (ctx: NextPageContext) => void
  App: AppType
  unstable_getStaticProps?: Unstable_getStaticProps
  unstable_getStaticPaths?: Unstable_getStaticPaths
  unstable_getServerProps?: Unstable_getServerProps
}

function requireUncached(module) {
  delete require.cache[require.resolve(module)]
  return require(module)
}

export async function loadComponents(
  distDir: string,
  buildId: string,
  pathname: string,
  serverless: boolean
): Promise<LoadComponentsReturnType> {
  if (serverless) {
    const Component = await requirePage(pathname, distDir, serverless)
    return {
      Component,
      pageConfig: Component.config || {},
      unstable_getStaticProps: Component.unstable_getStaticProps,
      unstable_getStaticPaths: Component.unstable_getStaticPaths,
    } as LoadComponentsReturnType
  }
  const documentPath = join(
    distDir,
    SERVER_DIRECTORY,
    CLIENT_STATIC_FILES_PATH,
    buildId,
    'pages',
    '_document'
  )
  const appPath = join(
    distDir,
    SERVER_DIRECTORY,
    CLIENT_STATIC_FILES_PATH,
    buildId,
    'pages',
    '_app'
  )

  const DocumentMod = require(documentPath)
  const { middleware: DocumentMiddleware } = DocumentMod

  const AppMod = require(appPath)

  const ComponentMod = requirePage(pathname, distDir, serverless)

  const [
    buildManifest,
    reactLoadableManifest,
    Component,
    Document,
    App,
  ] = await Promise.all([
    // bust require cache on hmr
    requireUncached(join(distDir, BUILD_MANIFEST)),
    requireUncached(join(distDir, REACT_LOADABLE_MANIFEST)),
    interopDefault(ComponentMod),
    interopDefault(DocumentMod),
    interopDefault(AppMod),
  ])

  return {
    App,
    Document,
    Component,
    buildManifest,
    DocumentMiddleware,
    reactLoadableManifest,
    pageConfig: ComponentMod.config || {},
    unstable_getServerProps: ComponentMod.unstable_getServerProps,
    unstable_getStaticProps: ComponentMod.unstable_getStaticProps,
    unstable_getStaticPaths: ComponentMod.unstable_getStaticPaths,
  }
}
