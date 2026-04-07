import { useEffect } from "react";

interface SEOOptions {
  title: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonical?: string;
}

export function useSEO({ title, description, keywords, ogImage, canonical }: SEOOptions) {
  useEffect(() => {
    const siteName = "أويو بلاست";
    const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
    document.title = fullTitle;

    const setMeta = (selector: string, content: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        const attr = selector.startsWith('meta[name') ? 'name' : 'property';
        const val = selector.match(/["']([^"']+)["']/)?.[1] ?? '';
        el.setAttribute(attr, val);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    if (description) {
      setMeta('meta[name="description"]', description);
      setMeta('meta[property="og:description"]', description);
      setMeta('meta[name="twitter:description"]', description);
    }
    if (keywords) setMeta('meta[name="keywords"]', keywords);
    setMeta('meta[property="og:title"]', fullTitle);
    setMeta('meta[name="twitter:title"]', fullTitle);
    if (ogImage) {
      setMeta('meta[property="og:image"]', ogImage);
      setMeta('meta[name="twitter:image"]', ogImage);
    }

    const canonicalUrl = canonical ?? window.location.href;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonicalUrl;

    return () => {
      document.title = "أويو بلاست | مستلزمات التغليف والأكياس - اليمن والسعودية";
    };
  }, [title, description, keywords, ogImage, canonical]);
}
