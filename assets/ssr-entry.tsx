import { createInertiaApp } from '@inertiajs/react'
import createServer from '@inertiajs/react/server'
import ReactDOMServer from 'react-dom/server'

createServer((page) =>
  createInertiaApp({
    page,
    render: ReactDOMServer.renderToString,
    resolve: (name) => {
      const pages = import.meta.glob('../pages/**/*.tsx', { eager: true })
      const mod = pages[`../pages/${name}.tsx`]
      if (!mod) throw new Error(`Missing Inertia page: '${name}.tsx'`)
      return mod.default
    },
    setup: ({ App, props }) => <App {...props} />,
    defaults: {
      form: {
        forceIndicesArrayFormatInFormData: false,
      },
    },
  }),
)
