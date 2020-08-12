import { BUILD_MANIFEST, REACT_LOADABLE_MANIFEST } from '../lib/constants'
import { join } from 'path'
import { requirePage } from './require'
import { BuildManifest } from './get-page-files'
import { AppType, DocumentType } from '../lib/utils'
import {
  PageConfig,
  GetStaticPaths,
  GetServerSideProps,
  GetStaticProps
} from 'next/types'

export function interopDefault(mod: any) {
  return mod.default || mod
}

export type ManifestItem = {
  id: number | string
  name: string
  file: string
}

type ReactLoadableManifest = { [moduleId: string]: ManifestItem[] }

export type LoadComponentsReturnType = {
  Component: React.ComponentType
  pageConfig?: PageConfig
  buildManifest: BuildManifest
  reactLoadableManifest: ReactLoadableManifest
  Document: DocumentType
  App: AppType
  getStaticProps?: GetStaticProps
  getStaticPaths?: GetStaticPaths
  getServerSideProps?: GetServerSideProps
}

export async function loadComponents(
  distDir: string,
  pathname: string,
  serverless: boolean
): Promise<LoadComponentsReturnType> {
  if (serverless) {
    const Component = await requirePage(pathname, distDir, serverless)
    const { getStaticProps, getStaticPaths, getServerSideProps } = Component

    return {
      Component,
      pageConfig: Component.config || {},
      getStaticProps,
      getStaticPaths,
      getServerSideProps
    } as LoadComponentsReturnType
  }

  const DocumentMod = requirePage('/_document', distDir, serverless)
  const AppMod = requirePage('/_app', distDir, serverless)
  const ComponentMod = requirePage(pathname, distDir, serverless)
  const [
    buildManifest,
    reactLoadableManifest,
    Component,
    Document,
    App
  ] = await Promise.all([
    require(join(distDir, BUILD_MANIFEST)),
    require(join(distDir, REACT_LOADABLE_MANIFEST)),
    interopDefault(ComponentMod),
    interopDefault(DocumentMod),
    interopDefault(AppMod)
  ])
  console.log('load-component', { reactLoadableManifest })
  console.log('load-component', { buildManifest })
  console.log('transduce', Object.entries(buildManifest.pages))
  const federatedManifest = Object.entries(buildManifest.pages).reduce((acc, item) => {
    const joined = Array.from(new Set(reactLoadableManifest.federation.map(({ file }) => file))).concat(item[1])
    acc[item[0]] = joined
    return acc
  }, {})
  buildManifest.pages = federatedManifest
  const { getServerSideProps, getStaticProps, getStaticPaths } = ComponentMod

  return {
    App,
    Document,
    Component,
    buildManifest,
    reactLoadableManifest,
    pageConfig: ComponentMod.config || {},
    getServerSideProps,
    getStaticProps,
    getStaticPaths
  }
}
