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
    const errorBody = await response.json();
    console.error("Upload API Error", response.status, errorBody);
    throw new Error(`Upload API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
  }
  const json = await response.json();
  // Assuming json[0] is the uploaded file object
  const fileInfo = json[0];
  return { id: fileInfo.id, url: fileInfo.url };
};
