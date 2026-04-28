import type { Metadata, Projects, Site, Socials, TechStack } from "@types";

export const SITE: Site = {
	NAME: "luckixf的blog",
	EMAIL: "hi@luckixf.top",
	DESCRIPTION: "在某个不知名角落里的博客小站",
	NUM_POSTS_ON_HOMEPAGE: 4,
	NUM_THOUGHTS_ON_HOMEPAGE: 3,
	NUM_RELATED_POSTS_ON_POST: 5,
};

export const HOME: Metadata = {
	TITLE: "主页",
	DESCRIPTION: "某个不知名角落里的博客小站",
};

export const BLOG: Metadata = {
	TITLE: "文章",
	DESCRIPTION: "记录我的思考和学习.",
};

export const THOUGHTS: Metadata = {
	TITLE: "碎碎念",
	DESCRIPTION: "日常随想与生活点滴.",
};

export const ABOUT: Metadata = {
	TITLE: "关于",
	DESCRIPTION: "关于我.",
};

export const FRIENDS: Metadata = {
	TITLE: "友链",
	DESCRIPTION: "我的朋友们.",
};

export const MESSAGES: Metadata = {
	TITLE: "留言板",
	DESCRIPTION: "在这里留下你的足迹和想说的话.",
};

export const PROJECTS: Projects = [
	{
		category: "项目",
		items: [
			{
				name: "My Blog",
				href: "https://github.com/luckixf/blog",
				description: "我的个人博客，基于 Astro Doge 主题",
			},
			{
				name: "Side Project",
				href: "https://github.com/luckixf/side-project",
				badge: "WIP",
				description: "一个正在开发中的项目",
			},
		],
	},
];

export const TECH_STACK: TechStack = [
	{
		category: "语言",
		items: [
			{
				name: "TypeScript",
				href: "https://www.typescriptlang.org/",
				description: "带有类型语法的 JavaScript",
			},
			{
				name: "JavaScript",
				href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
				description: "函数为一等公民的轻量级解释型编程语言",
			},
		],
	},
	{
		category: "前端",
		items: [
			{
				name: "Astro",
				href: "https://astro.build/",
				description: "用于构建内容驱动网站的 Web 框架",
			},
			{
				name: "Tailwind CSS",
				href: "https://tailwindcss.com/",
				description: "实用优先的 CSS 框架",
			},
		],
	},
];

export const SOCIALS: Socials = [
	{
		NAME: "GitHub",
		HREF: "https://github.com/luckixf",
	},
];
