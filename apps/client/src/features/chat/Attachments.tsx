import type { Attachment } from '@teamchat/shared';
import { FileCard } from '../../components/ui/FileCard';
import { ImageAttachment } from '../../components/ui/ImageAttachment';
import { downloadUrl, thumbnailUrl } from '../../lib/cloudinary';

/** A message's files: one image with its caption, 2+ images as a 2-column grid, then PDFs. */
export function Attachments({ attachments }: { attachments: Attachment[] }) {
  const images = attachments.filter((a) => a.kind === 'image');
  const files = attachments.filter((a) => a.kind === 'file');
  if (!attachments.length) return null;

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      {images.length === 1 && (
        <ImageAttachment {...images[0]!} thumbUrl={thumbnailUrl(images[0]!.url)} />
      )}
      {images.length > 1 && (
        <div className="grid w-[300px] max-w-full grid-cols-2 gap-1">
          {images.map((a) => (
            <ImageAttachment
              key={a.url}
              {...a}
              thumbUrl={thumbnailUrl(a.url)}
              caption={false}
              className="w-full"
            />
          ))}
        </div>
      )}
      {files.map((a) => (
        <FileCard key={a.url} name={a.name} size={a.size} downloadUrl={downloadUrl(a.url)} />
      ))}
    </div>
  );
}
