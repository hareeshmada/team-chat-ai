/**
 * Cloudinary delivery URLs take transformations as a path segment after /upload/:
 *   …/image/upload/v17/teamchat/u1/abc.png → …/image/upload/w_400,f_auto,q_auto/v17/teamchat/u1/abc.png
 * Cloudinary makes (and caches) that variant on first request: 400px wide, the best format the
 * browser accepts (WebP/AVIF), automatic quality. No server work on our side.
 */
function withTransform(url: string, transform: string): string {
  return url.replace('/upload/', `/upload/${transform}/`);
}

export const thumbnailUrl = (url: string) => withTransform(url, 'w_400,f_auto,q_auto');

/** fl_attachment: Cloudinary answers with Content-Disposition: attachment (a download). */
export const downloadUrl = (url: string) => withTransform(url, 'fl_attachment');
