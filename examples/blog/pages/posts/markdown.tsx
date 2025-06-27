import React from 'react';

export const meta = {
  title: "Markdown Examples",
  date: "2021/3/19",
  description: "View examples of all possible Markdown options.",
  tag: "web development",
  author: "You",
};

const MarkdownPage: React.FC = () => {
  return (
    <article>
      <h1>Markdown Examples</h1>
      <p>PAGE_HMR_AREA</p>
      <h2>h2 Heading</h2>
      <h3>h3 Heading</h3>
      <h4>h4 Heading</h4>
      <h5>h5 Heading</h5>
      <h6>h6 Heading</h6>
      <h2>Emphasis</h2>
      <p><strong>This is bold text</strong></p>
      <p><em>This is italic text</em></p>
      <p><s>Strikethrough</s></p>
      <h2>Blockquotes</h2>
      <blockquote>
        <p>Develop. Preview. Ship. – Vercel</p>
      </blockquote>
      <h2>Lists</h2>
      <p>Unordered</p>
      <ul>
        <li>Lorem ipsum dolor sit amet</li>
        <li>Consectetur adipiscing elit</li>
        <li>Integer molestie lorem at massa</li>
      </ul>
      <p>Ordered</p>
      <ol>
        <li>Lorem ipsum dolor sit amet</li>
        <li>Consectetur adipiscing elit</li>
        <li>Integer molestie lorem at massa</li>
      </ol>
      <h2>Code</h2>
      <p>Inline <code>code</code></p>
      <pre>
        <code>
{`export default function Nextra({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="RSS"
          href="/feed.xml"
        />
        <link
          rel="preload"
          href="/fonts/Inter-roman.latin.var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </Head>
      <Component {...pageProps} />
    </>
  )
}`}
        </code>
      </pre>
      <h2>Tables</h2>
      <table>
        <thead>
          <tr>
            <th><strong>Option</strong></th>
            <th><strong>Description</strong></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>First</td>
            <td>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</td>
          </tr>
          <tr>
            <td>Second</td>
            <td>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</td>
          </tr>
          <tr>
            <td>Third</td>
            <td>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</td>
          </tr>
        </tbody>
      </table>
      <h2>Links</h2>
      <ul>
        <li><a href="https://nextjs.org">Next.js</a></li>
        <li><a href="https://nextra.vercel.app/">Nextra</a></li>
        <li><a href="http://vercel.com">Vercel</a></li>
      </ul>
      <h3>Footnotes</h3>
      <ul>
        <li>Footnote <sup><a href="#fn1" id="fnref1">1</a></sup>.</li>
        <li>Footnote <sup><a href="#fn2" id="fnref2">2</a></sup>.</li>
      </ul>
      <hr />
      <ol>
        <li id="fn1">
          <p>Footnote <strong>can have markup</strong></p>
          <p>and multiple paragraphs. <a href="#fnref1">↩</a></p>
        </li>
        <li id="fn2">
          <p>Footnote text. <a href="#fnref2">↩</a></p>
        </li>
      </ol>
    </article>
  );
};

export default MarkdownPage;

// Force server-side rendering to disable SSG for HMR testing
export async function getServerSideProps() {
  return {
    props: {}, // Will be passed to the page component as props
  };
}
