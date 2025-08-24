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