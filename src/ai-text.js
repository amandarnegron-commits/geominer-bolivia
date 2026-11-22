/** Presentación segura del Markdown ligero devuelto por OpenAI, sin HTML dinámico. */
export function normalizeAiText(text) {
  return String(text || '')
    .replace(/\r\n/g,'\n')
    .replace(/\\(?=#{1,6}\s)/g,'')
    .replace(/\\\*/g,'*')
    .replace(/\\_/g,'_')
    .trim();
}
export function aiBlocks(text) {
  return normalizeAiText(text).split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    return heading ? {kind:'heading',text:heading[1]} : {kind:'paragraph',text:line};
  });
}
export function aiPlainText(text) {
  return aiBlocks(text).map(block=>block.text.replace(/\*\*/g,'').replace(/__(.*?)__/g,'$1')).join('\n\n');
}
