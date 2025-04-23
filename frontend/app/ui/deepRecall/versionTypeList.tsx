import React from "react";
import { useVersionTypes } from "../../customHooks/useLiterature";
import { transformVersion, VersionType } from "../../types/deepRecall/strapi/versionTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteVersionType } from "../../api/literatureService";

export interface VersionTypeListProps {
  itemsPerRow?: number;
  className?: string;
  cardClassName?: string;
}

const VersionTypeList: React.FC<VersionTypeListProps> = ({
  itemsPerRow = 3,
  className = "",
  cardClassName = "",
}) => {
  const { data: types, isLoading, error } = useVersionTypes();
  const queryClient = useQueryClient();
  const delMutation = useMutation<void, Error, string>({
    mutationFn: deleteVersionType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["versionTypes"] }),
  });

  if (isLoading) return <p>Loading version types...</p>;
  if (error) return <p className="text-red-500">Failed to load version types</p>;

  return (
    <div className={`my-6 p-4 bg-gray-700 rounded-lg ${className}`}>
      <h3 className="text-xl font-semibold mb-2">Available Version Types</h3>
      <hr className="border-gray-600 mb-4" />

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${itemsPerRow}, minmax(0, 1fr))` }}
      >
        {types?.map((vt: VersionType) => {
          const ext = transformVersion(vt);
          const displayName = vt.name
            ? vt.name.charAt(0).toUpperCase() + vt.name.slice(1)
            : "";

          // gather core + custom metadata entries
          const metaEntries: [string, any][] = [];
          if (ext.publishingDate !== undefined) metaEntries.push(["publishingDate", ext.publishingDate]);
          if (ext.versionTitle !== undefined)    metaEntries.push(["versionTitle", ext.versionTitle]);
          if (ext.editionNumber !== undefined)  metaEntries.push(["editionNumber", ext.editionNumber]);
          if (ext.versionNumber !== undefined)  metaEntries.push(["versionNumber", ext.versionNumber]);
          Object.entries(ext.customMetadata).forEach(([k, v]) => metaEntries.push([k, v]));

          return (
            <div
              key={vt.documentId}
              className={`p-4 border rounded flex flex-col ${cardClassName}`}
            >
              <h4 className="font-bold mb-2">{displayName}</h4>
              {metaEntries.length > 0 && (
                <>
                  <hr className="my-2 border-gray-500" />
                  <div className="flex flex-wrap gap-2">
                    {metaEntries.map(([k, v]) => {
                      const type = Array.isArray(v) ? "array" : typeof v;
                      return (
                        <span
                          key={k}
                          className="relative group px-2 py-1 border rounded text-sm cursor-pointer"
                        >
                          {k}
                          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-xs whitespace-nowrap px-1 py-0.5 rounded">
                            {type}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
              <button
                className="mt-4 w-full text-center text-sm text-red-500 border-red-500 border rounded hover:bg-red-500 hover:text-white transition-colors"
                onClick={() => {
                  if (
                    vt.documentId &&
                    confirm(
                      `Delete version type "${displayName}"? This cannot be undone.`
                    )
                  ) {
                    delMutation.mutate(vt.documentId);
                  }
                }}
              >
                Delete
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VersionTypeList;
