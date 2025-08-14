import { Block } from "./BlocksPalette";

export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .sort((a, b) => a.order - b.order)
    .map(block => {
      switch (block.type) {
        case 'text':
          return block.content?.text || '';
          
        case 'image':
          if (!block.content?.url) return '';
          const caption = block.content.caption ? ` "${block.content.caption}"` : '';
          return `![${block.content.caption || 'Image'}](${block.content.url}${caption})`;
          
        case 'video':
          if (!block.content?.url) return '';
          return `<iframe src="${getEmbedUrl(block.content.url)}" frameborder="0" allowfullscreen></iframe>`;
          
        case 'audio':
          if (!block.content?.url) return '';
          return `<audio controls><source src="${block.content.url}" /></audio>`;
          
        case 'quote':
          if (!block.content?.text) return '';
          const attribution = block.content.attribution ? `\n\n— ${block.content.attribution}` : '';
          return `> ${block.content.text}${attribution}`;
          
        case 'divider':
          return '---';
          
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n\n');
}

export function markdownToBlocks(markdown: string): Block[] {
  if (!markdown.trim()) return [];
  
  // Simple parsing - split by double newlines and create text blocks
  // In a full implementation, you'd parse the actual markdown structure
  const sections = markdown.split('\n\n').filter(Boolean);
  
  return sections.map((section, index) => {
    // Detect different block types based on content
    if (section.startsWith('![')) {
      // Image
      const match = section.match(/!\[(.*?)\]\((.*?)(?:\s+"(.*?)")?\)/);
      if (match) {
        return {
          id: `block-${Date.now()}-${index}`,
          type: 'image' as const,
          content: { url: match[2], caption: match[3] || match[1] },
          order: index,
        };
      }
    } else if (section.startsWith('>')) {
      // Quote
      const lines = section.split('\n');
      const text = lines
        .filter(line => line.startsWith('>'))
        .map(line => line.substring(1).trim())
        .join('\n');
      const attribution = lines.find(line => line.startsWith('—'))?.substring(1).trim();
      
      return {
        id: `block-${Date.now()}-${index}`,
        type: 'quote' as const,
        content: { text, attribution },
        order: index,
      };
    } else if (section.trim() === '---') {
      // Divider
      return {
        id: `block-${Date.now()}-${index}`,
        type: 'divider' as const,
        content: {},
        order: index,
      };
    } else if (section.includes('<iframe') || section.includes('<audio')) {
      // Video or audio
      const isVideo = section.includes('<iframe');
      const srcMatch = section.match(/src="([^"]+)"/);
      
      return {
        id: `block-${Date.now()}-${index}`,
        type: isVideo ? 'video' as const : 'audio' as const,
        content: { url: srcMatch?.[1] || '' },
        order: index,
      };
    }
    
    // Default to text
    return {
      id: `block-${Date.now()}-${index}`,
      type: 'text' as const,
      content: { text: section },
      order: index,
    };
  });
}

function getEmbedUrl(url: string): string {
  // Convert YouTube/Vimeo URLs to embed format
  if (url.includes('youtube.com/watch')) {
    const videoId = url.split('v=')[1]?.split('&')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  } else if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  } else if (url.includes('vimeo.com/')) {
    const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
    return `https://player.vimeo.com/video/${videoId}`;
  }
  
  return url;
}