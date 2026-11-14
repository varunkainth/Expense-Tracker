import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
export async function mergeReceiptPdf(attachments:{filename:string;mimeType:string;bytes:Uint8Array}[]):Promise<Uint8Array> {
  if(!attachments.length)throw new Error('No expense attachments were found for the selected period.');
  const output=await PDFDocument.create(),font=await output.embedFont(StandardFonts.Helvetica);
  const label=(value:string)=>Array.from(value).map((letter)=>{try{font.encodeText(letter);return letter;}catch{return '?';}}).join('');
  for(const attachment of attachments){
    try{
      const page=output.addPage([595.28,841.89]);
      const filename=label(attachment.filename);
      const maxWidth=515.28;let text=filename.length>120?filename.slice(0,117)+'...':filename;
      while(font.widthOfTextAtSize(text,10)>maxWidth && text.length>3)text=text.slice(0,-4)+'...';
      page.drawText(text,{x:40,y:786.89,size:10,font,color:rgb(0.35,0.39,0.45)});
      if(attachment.mimeType==='application/pdf'){
        const source=await PDFDocument.load(attachment.bytes);
        if(!source.getPageCount())throw new Error('PDF has no pages.');
        for(const copied of await output.copyPages(source,source.getPageIndices()))output.addPage(copied);
      }else if(attachment.mimeType==='image/jpeg'){
        const image=await output.embedJpg(attachment.bytes),scale=Math.min(515.28/image.width,741.89/image.height);
        const width=image.width*scale,height=image.height*scale;
        page.drawImage(image,{x:(595.28-width)/2,y:35+(741.89-height)/2,width,height});
      }else throw new Error('Unsupported receipt type.');
    }catch{throw new Error(`Could not export receipt “${attachment.filename}”. Check whether it is damaged or password-protected.`);}
  }
  return output.save({useObjectStreams:true});
}
