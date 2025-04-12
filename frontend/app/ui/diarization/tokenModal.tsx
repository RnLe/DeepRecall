// tokenModal.tsx

import React from 'react';

interface TokenModalProps {
  hfToken: string | null;
  hfTokenInput: string;
  tokenMessage: string;
  setHfTokenInput: (value: string) => void;
  setTokenMessage: (value: string) => void;
  setShowTokenModal: (value: boolean) => void;
  setHfToken: (value: string) => void;
}

export const TokenModal: React.FC<TokenModalProps> = ({
  hfToken,
  hfTokenInput,
  tokenMessage,
  setHfTokenInput,
  setTokenMessage,
  setShowTokenModal,
  setHfToken,
}) => {
  return (
    <div
      onClick={() => setShowTokenModal(false)}
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-800 p-4 rounded w-80"
      >
        <h3 className="text-lg font-bold mb-2">Provide Hugging Face Token</h3>
        <input
          type="text"
          value={hfTokenInput}
          onChange={(e) => setHfTokenInput(e.target.value)}
          className="w-full p-2 mb-2 bg-gray-700 border border-gray-600 rounded"
          placeholder="Enter token"
        />
        {tokenMessage && <p className="mb-2">{tokenMessage}</p>}
        <div className="flex justify-end">
          <button
            onClick={() => {
              fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/apitokens`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: "Hugging Face", token: hfTokenInput })
              })
                .then((res) => res.json())
                .then((data) => {
                  if (data.message) {
                    setTokenMessage(data.message);
                    setHfToken(data.tokens["Hugging Face"]);
                    setTimeout(() => {
                      setShowTokenModal(false);
                      setTokenMessage("");
                    }, 2000);
                  } else {
                    setTokenMessage("Error updating token");
                  }
                })
                .catch((err) => setTokenMessage("Error updating token"));
            }}
            className="px-3 py-1 bg-green-500 rounded mr-2"
          >
            Submit
          </button>
          <button
            onClick={() => {
              setShowTokenModal(false);
              setTokenMessage("");
            }}
            className="px-3 py-1 bg-gray-500 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
