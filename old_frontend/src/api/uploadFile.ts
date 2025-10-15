// uploadFile.ts

export interface UploadedFileInfo {
  id: number;
  url: string;
}

export const uploadFile = async (file: File): Promise<UploadedFileInfo> => {
  const formData = new FormData();
  formData.append("files", file);
  const response = await fetch("http://localhost:1337/api/upload", {
    method: "POST",
    body: formData,
    headers: {
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}`,
    },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Upload API Error: ${response.status} – ${JSON.stringify(err)}`);
  }
  const json = await response.json();
  const f = json[0];
  return { id: f.id, url: f.url };
};

export const deleteFile = async (fileId: number): Promise<void> => {
  const res = await fetch(`http://localhost:1337/api/upload/files/${fileId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}`,
    },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Delete file failed: ${res.status} – ${JSON.stringify(err)}`);
  }
};