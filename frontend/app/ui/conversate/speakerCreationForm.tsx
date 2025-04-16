// speakerCreationForm.tsx
import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import SparkMD5 from 'spark-md5';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../helpers/cropImage';
import { Speaker } from '../../types/diarizationTypes';

interface SpeakerCreationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  speaker?: Speaker | null;
}


const SpeakerCreationForm: React.FC<SpeakerCreationFormProps> = ({ onSuccess, onCancel, speaker }) => {
  const isEdit = Boolean(speaker);
  const [name, setName] = useState(speaker ? speaker.name : '');
  const [md5Hash, setMd5Hash] = useState(speaker ? speaker.id : '');
  const [color, setColor] = useState(speaker ? (speaker.color || '#FF0000') : '#FF0000');
  const [imageFile, setimageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    speaker && speaker.croppedImageUrl 
      ? `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/${speaker.croppedImageUrl}?t=${new Date().getTime()}`
      : null
  );
  const [warning, setWarning] = useState<string>('');
  const queryClient = useQueryClient();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showPresetSelection, setShowPresetSelection] = useState(false);

  // Cleanup and reset form fields when 'speaker' changes.
  useEffect(() => {
    if (speaker) {
      setName(speaker.name);
      setMd5Hash(speaker.id);
      setColor(speaker.color || '#FF0000');
      setPreviewUrl(speaker.croppedImageUrl ? `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/${speaker.croppedImageUrl}?t=${new Date().getTime()}` : null);
      setimageFile(null);
      setWarning('');
    } else {
      // If no speaker is provided (create mode), clear previous states.
      setName('');
      setMd5Hash('');
      setColor('#FF0000');
      setPreviewUrl(null);
      setimageFile(null);
      setWarning('');
    }
  }, [speaker]);

  // Compute MD5 hash on name change only when creating a speaker.
  useEffect(() => {
    if (!isEdit) {
      if (name) {
        const hash = SparkMD5.hash(name);
        setMd5Hash(hash);
      } else {
        setMd5Hash('');
      }
    }
  }, [name, isEdit]);

  // Generate a preview URL when a file is selected.
  useEffect(() => {
    if (selectedPreset) {
      setPreviewUrl(`/icons/avatarPlaceholders/${selectedPreset}`);
    } else if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (!imageFile && isEdit && speaker?.croppedImageUrl) {
      setPreviewUrl(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/${speaker.croppedImageUrl}?t=${new Date().getTime()}`);
    } else {
      setPreviewUrl(null);
    }
  }, [imageFile, selectedPreset, isEdit, speaker]);

  // Check for duplicate speaker (ignore self in edit mode).
  useEffect(() => {
    const speakers = queryClient.getQueryData<Speaker[]>(['speakers']);
    if (speakers && md5Hash) {
      const duplicate = speakers.some((s) => s.id === md5Hash && (!speaker || s.id !== speaker.id));
      if (duplicate) {
        setWarning('A speaker with this name already exists.');
      } else {
        setWarning('');
      }
    } else {
      setWarning('');
    }
  }, [md5Hash, queryClient, speaker]);

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
      queryClient.invalidateQueries({ queryKey: ['speaker', md5Hash] });
      onSuccess();
    },
  });

  // Mutation for updating an existing speaker.
  const updateSpeakerMutation = useMutation<any, Error, FormData>({
    mutationFn: async (updatedSpeaker: FormData) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/speakers/${md5Hash}`, {
        method: 'PUT',
        body: updatedSpeaker,
      });
      if (!res.ok) {
        throw new Error('Failed to update speaker');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speakers'] });
      queryClient.invalidateQueries({ queryKey: ['speaker', md5Hash] });
      onSuccess();
    },
  });

  // Mutation for removing a speaker.
  const removeSpeakerMutation = useMutation<any, Error, string>({
    mutationFn: async (speakerId: string) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/speakers/${speakerId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to remove speaker');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speakers'] });
      onCancel();
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setimageFile(e.target.files[0]);
      setSelectedPreset(null);
    }
  };

  const handleCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
    console.log('Cropped area pixels:', croppedAreaPixels);
  };

  const handleCropSave = async () => {
    if (selectedPreset) return;
    const imageToCrop = imageFile ? URL.createObjectURL(imageFile) : (speaker?.originalImageUrl ? `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/${speaker.originalImageUrl}` : '');
    if (croppedAreaPixels && imageToCrop) {
      // Get the cropped image file using your helper.
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);

      setPreviewUrl(URL.createObjectURL(croppedImage));
      setIsCropping(false);
    }
  };
  

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const speakers = queryClient.getQueryData<Speaker[]>(['speakers']);
    const duplicate = speakers ? speakers.some((s) => s.id === md5Hash && (!speaker || s.id !== speaker.id)) : false;
    if (duplicate) {
      setWarning('A speaker with this name already exists.');
      return;
    }
    const formData = new FormData();
    formData.append('id', md5Hash);
    formData.append('name', name);
    formData.append('color', color);
    if (selectedPreset) {
      formData.append('presetAvatar', selectedPreset);
    } else {
      if (imageFile) {
        formData.append('image', imageFile);
      }
      if (croppedAreaPixels) {
        const { width, height, x, y } = croppedAreaPixels;
        const croppedAreaString = `${width},${height},${x},${y}`; // Format as "width,height,x,y"
        formData.append('croppedArea', croppedAreaString);
      }
    }
    if (isEdit) {
      updateSpeakerMutation.mutate(formData);
    } else {
      createSpeakerMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (isEdit && window.confirm('Are you sure you want to delete this speaker?')) {
      removeSpeakerMutation.mutate(md5Hash);
    }
  };

  const isDuplicate = warning !== '';

  return (
    <>
      <h3 className="text-lg font-semibold mb-4 text-white">
        {isEdit ? 'Edit Speaker' : 'Create New Speaker'}
      </h3>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 block w-full bg-gray-700 border border-gray-600 p-2 rounded text-white"
          />
          <p className="mt-1 text-sm text-gray-400">Speaker ID: {md5Hash}</p>
        </div>
        {warning && (
          <div className="text-red-500 text-sm">
            {warning}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-300">Color</label>
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
          {previewUrl && !selectedPreset && (
            <div className="mt-2">
              <img
                src={previewUrl}
                alt="Avatar Preview"
                className="w-16 h-16 rounded-full object-cover cursor-pointer"
                onClick={() => setIsCropping(true)}
              />
            </div>
          )}
        </div>
        <div>
          <button 
            type="button"
            className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
            onClick={() => setShowPresetSelection(!showPresetSelection)}
          >
            {showPresetSelection ? 'Hide Presets' : 'Choose Preset Avatar'}
          </button>
        </div>
        {showPresetSelection && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              'avatar_placeholder_feminine_01.png',
              'avatar_placeholder_feminine_02.png',
              'avatar_placeholder_feminine_03.png',
              'avatar_placeholder_masculine_01.png',
              'avatar_placeholder_masculine_02.png',
              'avatar_placeholder_masculine_03.png'
            ].map((preset) => (
              <img
                key={preset}
                src={`/icons/avatarPlaceholders/${preset}`}
                alt={preset}
                className={`w-16 h-16 rounded-full object-cover cursor-pointer border-2 ${selectedPreset === preset ? 'border-blue-500' : 'border-transparent'}`}
                onClick={() => {
                  setSelectedPreset(preset);
                  setimageFile(null);
                  setIsCropping(false);
                  setShowPresetSelection(false);
                }}
              />
            ))}
          </div>
        )}
        {previewUrl && selectedPreset && (
          <div className="mt-2">
            <img
              src={previewUrl}
              alt="Preset Avatar Preview"
              className="w-16 h-16 rounded-full object-cover"
            />
          </div>
        )}
        {isCropping && !selectedPreset && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="relative w-96 h-96 bg-gray-900 p-4 rounded">
              <Cropper
                image={
                  imageFile 
                  ? URL.createObjectURL(imageFile) 
                  : (speaker?.originalImageUrl 
                     ? `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/${speaker.originalImageUrl}` 
                     : '')
                }
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
              <div className="absolute bottom-4 right-4 flex space-x-2 z-50">
                <button
                  type="button"
                  onClick={() => setIsCropping(false)}
                  className="bg-gray-600 text-gray-200 px-4 py-2 rounded hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCropSave}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={isEdit ? updateSpeakerMutation.isPending : createSpeakerMutation.isPending || isDuplicate}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isEdit
              ? (updateSpeakerMutation.isPending ? 'Updating...' : 'Update')
              : (createSpeakerMutation.isPending ? 'Creating...' : 'Create')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-600 text-gray-200 px-4 py-2 rounded hover:bg-gray-500"
          >
            Cancel
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={removeSpeakerMutation.isPending}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
            >
              {removeSpeakerMutation.isPending ? 'Removing...' : 'Delete'}
            </button>
          )}
        </div>
        {(!isEdit && createSpeakerMutation.isError) || (isEdit && updateSpeakerMutation.isError) && (
          <p className="text-red-500 text-sm">Error {isEdit ? 'updating' : 'creating'} speaker.</p>
        )}
      </form>
    </>
  );
};

export default SpeakerCreationForm;
