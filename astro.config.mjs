import vercel from '@astrojs/vercel'
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import astroExpressiveCode from "astro-expressive-code";
import rehypeSlug from "rehype-slug";
import rehypeHeadingLinks from "./src/lib/rehype/rehype-heading-links.mjs";
import remarkGithubAlerts from "./src/lib/remark/github-alert.mjs";
import remarkDemoteH1ToH2 from "./src/lib/remark/remark-demote-h1.mjs";
import remarkExternalLinks from "./src/lib/remark/remark-external-links.mjs";

export default defineConfig({
	site: "https://blog.luckixf.top/",
	compressHTML: true,

	output: 'server',
    adapter: vercel(),

	build: {
		inlineStylesheets: "auto",
	},

	integrations: [
		astroExpressiveCode({
			themes: ["github-dark"],
			frames: {
				showCopyToClipboardButton: false,
			},
		}),
		mdx(),
		sitemap({
			filter: (page) => !page.includes("/offline"),
		}),
	],

	markdown: {
		remarkPlugins: [
			remarkGithubAlerts,
			remarkDemoteH1ToH2,
			[remarkExternalLinks, { allowHostnames: ["example.com"] }],
		],
		rehypePlugins: [rehypeSlug, rehypeHeadingLinks],
	},

	vite: {
		plugins: [tailwindcss()],
	},
});
