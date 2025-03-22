// uploadFile.ts

export const uploadFile = async (file: File): Promise<number> => {
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
    // Nehme an, dass nur eine Datei hochgeladen wurde
    return json[0].id;
  };
  