type PagesFunction = (context: any) => Promise<Response> | Response;
export const onRequest: PagesFunction = async (context) => {
    const { tick } = context.params; // 比如 ttai
    let title = tick;
    let image = "https://tiptag.oss-cn-shenzhen.aliyuncs.com/tagai/brand/yellow.jpg";
  
    // 1. 查询数据库 API 获取图片
    try {
      const apiUrl = `https://bsc-api.tagai.fun/community/detail?tick=${tick}`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        if (data?.logo) image = data.logo;
        if (data?.name) title = data.name;
      }
    } catch (e) {
      console.error("API 查询失败", e);
    }
  
    // 2. 读取打包后的 index.html
    let html = await context.env.ASSETS.fetch(context.request).then(res => res.text());
  
    // 3. 替换 meta 标签
    html = html.replace(/<title>.*<\/title>/, `<title>${title}</title>`);
    html = html.replace(/<meta name="twitter:image" content=".*">/, `<meta name="twitter:image" content="${image}">`);
    html = html.replace(/<meta property="og:image" content=".*">/, `<meta property="og:image" content="${image}">`);
  
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  };