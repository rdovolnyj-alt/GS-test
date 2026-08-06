export async function uploadFile(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  return data.url ?? null;
}

export async function uploadFiles(files: FileList | File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of Array.from(files)) {
    const url = await uploadFile(file);
    if (url) urls.push(url);
  }
  return urls;
}
