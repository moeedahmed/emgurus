import DOMPurify from "dompurify";

export interface MediaEmbed {
  type: 'youtube' | 'vimeo' | 'audio' | 'pdf' | 'image';
  url: string;
  id?: string;
}

export function processMediaEmbeds(html: string): string {
  // YouTube embeds
  html = html.replace(
    /(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g,
    '<div class="my-6"><iframe width="100%" height="315" src="https://www.youtube.com/embed/$4" frameborder="0" allowfullscreen class="rounded-lg"></iframe></div>'
  );
  
  // Vimeo embeds
  html = html.replace(
    /(https?:\/\/)?(www\.)?vimeo\.com\/(\d+)/g,
    '<div class="my-6"><iframe width="100%" height="315" src="https://player.vimeo.com/video/$3" frameborder="0" allowfullscreen class="rounded-lg"></iframe></div>'
  );
  
  // Audio embeds
  html = html.replace(
    /(https?:\/\/[^\s]+\.(mp3|wav|ogg|m4a))/g,
    '<div class="my-6"><audio controls class="w-full"><source src="$1" type="audio/mpeg">Your browser does not support the audio element.</audio></div>'
  );
  
  // PDF embeds
  html = html.replace(
    /(https?:\/\/[^\s]+\.pdf)/g,
    '<div class="my-6 p-4 border rounded-lg bg-muted/20"><div class="flex items-center gap-2 mb-2"><svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><span class="font-medium">PDF Document</span></div><embed src="$1" type="application/pdf" width="100%" height="400" class="rounded" /></div>'
  );
  
  return html;
}

export interface ContentSection {
  type: 'text' | 'media';
  title?: string;
  content: string;
  mediaType?: 'youtube' | 'vimeo' | 'audio' | 'pdf' | 'image';
}

export function parseContentIntoSections(content: string): ContentSection[] {
  if (!content) return [];

  let html = content;
  
  // Basic markdown to HTML conversions first
  if (typeof html === 'string') {
    html = html
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/^\* (.*$)/gim, '<li class="mb-1">$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li class="mb-1">$1</li>');
    
    // Wrap list items in proper ul/ol tags
    html = html.replace(/(<li.*?>.*?<\/li>)/gs, (match) => {
      if (!match.includes('<ul>') && !match.includes('<ol>')) {
        return `<ul class="list-disc list-inside mb-4 space-y-1">${match}</ul>`;
      }
      return match;
    });
  }

  const sections: ContentSection[] = [];
  const lines = html.split('\n');
  let currentSection: ContentSection | null = null;
  let contentBuffer: string[] = [];

  const finishCurrentSection = () => {
    if (currentSection && contentBuffer.length > 0) {
      let content = contentBuffer.join('\n');
      content = content
        .replace(/\n\n/g, '</p><p class="mb-4">')
        .replace(/\n/g, '<br/>')
        .replace(/^(.)/g, '<p class="mb-4">$1')
        .replace(/(.)$/g, '$1</p>');
      
      currentSection.content = DOMPurify.sanitize(content);
      sections.push(currentSection);
      contentBuffer = [];
    }
  };

  for (const line of lines) {
    // Check for headings (section breaks)
    const h2Match = line.match(/^## (.*)$/);
    const h3Match = line.match(/^### (.*)$/);
    
    // Check for media URLs
    const youtubeMatch = line.match(/(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const vimeoMatch = line.match(/(https?:\/\/)?(www\.)?vimeo\.com\/(\d+)/);
    const audioMatch = line.match(/(https?:\/\/[^\s]+\.(mp3|wav|ogg|m4a))/);
    const pdfMatch = line.match(/(https?:\/\/[^\s]+\.pdf)/);

    if (h2Match || h3Match) {
      // Finish previous section
      finishCurrentSection();
      
      // Start new section
      const title = h2Match ? h2Match[1] : h3Match![1];
      const headingTag = h2Match ? 'h2' : 'h3';
      const headingClass = h2Match ? 'text-2xl font-semibold' : 'text-xl font-medium';
      
      currentSection = {
        type: 'text',
        title,
        content: `<${headingTag} class="${headingClass} mb-4">${title}</${headingTag}>`
      };
    } else if (youtubeMatch || vimeoMatch || audioMatch || pdfMatch) {
      // Finish previous section
      finishCurrentSection();
      
      // Create media section
      let mediaContent = '';
      let mediaType: 'youtube' | 'vimeo' | 'audio' | 'pdf' = 'youtube';
      
      if (youtubeMatch) {
        mediaType = 'youtube';
        mediaContent = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${youtubeMatch[4]}" frameborder="0" allowfullscreen class="rounded-lg"></iframe>`;
      } else if (vimeoMatch) {
        mediaType = 'vimeo';
        mediaContent = `<iframe width="100%" height="315" src="https://player.vimeo.com/video/${vimeoMatch[3]}" frameborder="0" allowfullscreen class="rounded-lg"></iframe>`;
      } else if (audioMatch) {
        mediaType = 'audio';
        mediaContent = `<audio controls class="w-full"><source src="${audioMatch[1]}" type="audio/mpeg">Your browser does not support the audio element.</audio>`;
      } else if (pdfMatch) {
        mediaType = 'pdf';
        mediaContent = `<div class="flex items-center gap-2 mb-4"><svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><span class="font-medium">PDF Document</span></div><embed src="${pdfMatch[1]}" type="application/pdf" width="100%" height="400" class="rounded" />`;
      }
      
      sections.push({
        type: 'media',
        content: mediaContent,
        mediaType
      });
      
      currentSection = null;
    } else {
      // Regular content line
      if (!currentSection) {
        currentSection = {
          type: 'text',
          content: ''
        };
      }
      contentBuffer.push(line);
    }
  }

  // Finish the last section
  finishCurrentSection();

  // If no sections were created, create a default one
  if (sections.length === 0 && content.trim()) {
    let processedContent = processMediaEmbeds(content);
    processedContent = processedContent
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/\n/g, '<br/>')
      .replace(/^(.)/g, '<p class="mb-4">$1')
      .replace(/(.)$/g, '$1</p>');
    
    sections.push({
      type: 'text',
      content: DOMPurify.sanitize(processedContent)
    });
  }

  return sections;
}

export function renderMarkdownToHtml(content: string): string {
  if (!content) return "";
  
  let html = content;
  
  // Convert markdown-style content to HTML if needed
  if (typeof html === 'string') {
    // Basic markdown to HTML conversions
    html = html
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-semibold mt-6 mb-3">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-medium mt-4 mb-2">$1</h3>')
      .replace(/^\* (.*$)/gim, '<li class="mb-1">$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li class="mb-1">$1</li>')
      .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/\n/g, '<br/>')
      .replace(/^(.)/g, '<p class="mb-4">$1')
      .replace(/(.)$/g, '$1</p>');
    
    // Wrap list items in proper ul/ol tags
    html = html.replace(/(<li.*?>.*?<\/li>)/gs, (match) => {
      if (!match.includes('<ul>') && !match.includes('<ol>')) {
        return `<ul class="list-disc list-inside mb-4 space-y-1">${match}</ul>`;
      }
      return match;
    });
    
    // Process media embeds
    html = processMediaEmbeds(html);
  }
  
  return DOMPurify.sanitize(html);
}

export function generateAuthorBio(authorName: string, specialty?: string): string {
  const specialties = [
    "emergency medicine",
    "clinical knowledge sharing",
    "medical education",
    "patient care excellence",
    "evidence-based practice",
    "medical research",
    "healthcare innovation"
  ];
  
  const selectedSpecialty = specialty || specialties[Math.floor(Math.random() * specialties.length)];
  
  return `${authorName} specializes in ${selectedSpecialty} and is dedicated to advancing medical knowledge through collaborative learning and evidence-based practice.`;
}