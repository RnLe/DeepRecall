import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import SparkMD5 from 'spark-md5';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface SpeakerCreationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface Speaker {
  id: string;
  name: string;
  img?: string;
  ring_color?: string;
}

const SpeakerCreationForm: React.FC<SpeakerCreationFormProps> = ({ onSuccess, onCancel }) => {
  const [name, setName] = useState('');
  const [md5Hash, setMd5Hash] = useState('');
  const [color, setColor] = useState('#FF0000');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [warning, setWarning] = useState<string>('');
  const queryClient = useQueryClient();

  // Compute MD5 hash when the name changes.
  useEffect(() => {
    if (name) {
      const hash = SparkMD5.hash(name);
      setMd5Hash(hash);
    } else {
      setMd5Hash('');
    }
  }, [name]);

  // Generate a preview URL when a file is selected.
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  // Check if a speaker with this MD5 hash already exists.
  useEffect(() => {
    const speakers = queryClient.getQueryData<Speaker[]>(['speakers']);
    if (speakers && md5Hash) {
      const duplicate = speakers.some((speaker) => speaker.id === md5Hash);
      if (duplicate) {
        setWarning('A speaker with this name already exists.');
      } else {
        setWarning('');
      }
    } else {
      setWarning('');
    }
  }, [md5Hash, queryClient]);

  // Mutation for creating a new speaker.
  const createSpeakerMutation = useMutation<any, Error, FormData>({
    mutationFn: async (newSpeaker: FormData) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/speakers`, {
        method: 'POST',
        body: newSpeaker,
      });
      if (!res.ok) {
        throw new Error('Failed to create speaker');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speakers'] });
      onSuccess();
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const speakers = queryClient.getQueryData<Speaker[]>(['speakers']);
    const duplicate = speakers ? speakers.some((speaker) => speaker.id === md5Hash) : false;
    if (duplicate) {
      setWarning('A speaker with this name already exists.');
      return;
    }
    const formData = new FormData();
    formData.append('id', md5Hash);
    formData.append('name', name);
    formData.append('color', color);
    if (file) {
      formData.append('image', file);
    }
    createSpeakerMutation.mutate(formData);
  };

  // Determine if the submission should be disabled.
  const isDuplicate = warning !== '';

  return (
    <div className="p-4 border border-gray-700 rounded shadow bg-gray-800">
      <h3 className="text-lg font-semibold mb-4 text-white">Create New Speaker</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300">ID (MD5 Hash)</label>
          <input
            type="text"
            value={md5Hash}
            readOnly
            className="mt-1 block w-full bg-gray-600 border border-gray-500 p-2 rounded text-gray-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 block w-full bg-gray-700 border border-gray-600 p-2 rounded text-white"
          />
        </div>
        {warning && (
          <div className="text-red-500 text-sm">
            {warning}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-300">Ring Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="mt-1 w-16 h-10 p-1 border border-gray-600 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Upload Avatar</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="mt-1 block w-full bg-gray-700 border border-gray-600 p-2 rounded text-white"
          />
          {previewUrl && (
            <div className="mt-2">
              <img src={previewUrl} alt="Avatar Preview" className="w-16 h-16 rounded-full object-cover" />
            </div>
          )}
        </div>
        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={createSpeakerMutation.isPending || isDuplicate}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {createSpeakerMutation.isPending ? 'Creating...' : 'Create Speaker'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-600 text-gray-200 px-4 py-2 rounded hover:bg-gray-500"
          >
            Cancel
          </button>
        </div>
        {createSpeakerMutation.isError && (
          <p className="text-red-500 text-sm">Error creating speaker.</p>
        )}
      </form>
    </div>
  );
};

export default SpeakerCreationForm;
