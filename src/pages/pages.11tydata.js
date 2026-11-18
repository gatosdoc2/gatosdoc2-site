// Every page in this folder uses the page layout and gets a short root-relative URL:
// pages/index.md → /, pages/adocao.md → /adocao/
export default {
  layout: "layouts/page.njk",
  permalink: (data) => (data.page.fileSlug === "pages" || data.page.inputPath.endsWith("/index.md") ? "/" : `/${data.page.fileSlug}/`),
};
