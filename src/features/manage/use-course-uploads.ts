'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { uploadAsset } from './api';
import type { AssetSlot, CourseAsset, CourseDocument } from './types';

type UploadErrorHandler = (error: unknown) => boolean;

type UploadOptions = {
  onError?: UploadErrorHandler;
};

type UploadCounts = Partial<Record<AssetSlot, number>>;

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);
const maxImageBytes: Record<'thumbnail' | 'detailImage', number> = {
  thumbnail: 10 * 1024 * 1024,
  detailImage: 20 * 1024 * 1024,
};
const maxMaterialBytes = 100 * 1024 * 1024;

function extensionOf(file: File) {
  return file.name.split('.').pop()?.toLowerCase() ?? '';
}

function imageError(slot: Extract<AssetSlot, 'thumbnail' | 'detailImage'>, file: File) {
  if (!imageExtensions.has(extensionOf(file)) || (file.type && !imageTypes.has(file.type))) {
    return 'JPG, JPEG, PNG, WEBP 파일만 업로드할 수 있습니다.';
  }
  if (file.size > maxImageBytes[slot]) {
    return `${slot === 'thumbnail' ? '대표이미지는' : '상세이미지는'} ${slot === 'thumbnail' ? '10MB' : '20MB'} 이하로 업로드해주세요.`;
  }
  return null;
}

function materialError(file: File) {
  if (extensionOf(file) !== 'pdf' || (file.type && file.type !== 'application/pdf')) {
    return 'PDF 파일만 업로드할 수 있습니다.';
  }
  if (file.size > maxMaterialBytes) return '교재파일은 파일당 100MB 이하로 업로드해주세요.';
  return null;
}

async function ensureReadableImage(file: File) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve();
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function checksum(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function temporaryMaterial(file: File, fileChecksum: string): CourseAsset {
  return {
    id: `upload-${crypto.randomUUID()}`,
    name: file.name,
    url: '',
    size: file.size,
    type: file.type || 'application/pdf',
    checksum: fileChecksum,
    status: 'uploading',
  };
}

function isAbortError(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

export function useCourseUploads(
  document: CourseDocument,
  setDocument: Dispatch<SetStateAction<CourseDocument>>,
  options: UploadOptions = {},
) {
  const documentRef = useRef(document);
  const onErrorRef = useRef<UploadErrorHandler | undefined>(options.onError);
  const activeRef = useRef(true);
  const generationRef = useRef(0);
  const controllersRef = useRef(new Map<string, AbortController>());
  const filesRef = useRef(new Map<string, File>());
  const reservedChecksumsRef = useRef(new Set<string>());
  const materialQueueRef = useRef(Promise.resolve());
  const [counts, setCounts] = useState<UploadCounts>({});
  const [uploadErrors, setUploadErrors] = useState<Partial<Record<AssetSlot, string>>>({});

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  const changeCount = useCallback((slot: AssetSlot, change: number) => {
    setCounts(current => {
      const count = Math.max(0, (current[slot] ?? 0) + change);
      if (count === 0) {
        const rest = { ...current };
        delete rest[slot];
        return rest;
      }
      return { ...current, [slot]: count };
    });
  }, []);

  const report = useCallback((slot: AssetSlot, message: string) => {
    if (activeRef.current) setUploadErrors(current => ({ ...current, [slot]: message }));
  }, []);

  const clearError = useCallback((slot: AssetSlot) => {
    setUploadErrors(current => {
      if (!current[slot]) return current;
      const rest = { ...current };
      delete rest[slot];
      return rest;
    });
  }, []);

  const isCurrent = useCallback((generation: number) => activeRef.current && generation === generationRef.current, []);

  const uploadImage = useCallback(async (slot: Extract<AssetSlot, 'thumbnail' | 'detailImage'>, file: File) => {
    const generation = generationRef.current;
    const error = imageError(slot, file);
    if (error) {
      report(slot, error);
      return;
    }

    clearError(slot);
    changeCount(slot, 1);
    try {
      await ensureReadableImage(file);
      if (!isCurrent(generation)) return;
      const controller = new AbortController();
      const key = `image-${slot}`;
      controllersRef.current.get(key)?.abort();
      controllersRef.current.set(key, controller);
      const { asset } = await uploadAsset(slot, file, controller.signal);
      if (!isCurrent(generation) || controller.signal.aborted) return;
      setDocument(current => ({ ...current, basic: { ...current.basic, [slot]: asset } }));
      clearError(slot);
    } catch (error) {
      if (!isCurrent(generation) || isAbortError(error)) return;
      if (!onErrorRef.current?.(error)) report(slot, '업로드하지 못했습니다. 다시 시도해주세요.');
    } finally {
      if (isCurrent(generation)) changeCount(slot, -1);
    }
  }, [changeCount, clearError, isCurrent, report, setDocument]);

  const uploadMaterial = useCallback(async (id: string, file: File) => {
    const generation = generationRef.current;
    const controller = new AbortController();
    controllersRef.current.set(id, controller);
    changeCount('material', 1);
    try {
      const { asset } = await uploadAsset('material', file, controller.signal);
      if (!isCurrent(generation) || controller.signal.aborted) return;
      setDocument(current => ({
        ...current,
        basic: {
          ...current.basic,
          materials: current.basic.materials.map(material => material.id === id ? {
            ...asset,
            checksum: asset.checksum ?? material.checksum,
          } : material),
        },
      }));
      filesRef.current.delete(id);
      clearError('material');
    } catch (error) {
      if (!isCurrent(generation) || isAbortError(error)) return;
      if (onErrorRef.current?.(error)) return;
      setDocument(current => ({
        ...current,
        basic: {
          ...current.basic,
          materials: current.basic.materials.map(material => material.id === id ? {
            ...material,
            status: 'error',
            error: '업로드하지 못했습니다. 다시 시도해주세요.',
          } : material),
        },
      }));
    } finally {
      controllersRef.current.delete(id);
      if (isCurrent(generation)) changeCount('material', -1);
    }
  }, [changeCount, clearError, isCurrent, setDocument]);

  const onUpload = useCallback((slot: AssetSlot, files: File[]) => {
    if (slot === 'thumbnail' || slot === 'detailImage') {
      const file = files[0];
      if (file) void uploadImage(slot, file);
      return;
    }

    const generation = generationRef.current;
    changeCount('material', 1);
    const processSelection = async () => {
      try {
        const checked = await Promise.all(files.map(async file => {
          const error = materialError(file);
          return { file, error, checksum: error ? null : await checksum(file) };
        }));
        if (!isCurrent(generation)) return;
        const known = new Set([
          ...documentRef.current.basic.materials.map(item => item.checksum).filter((value): value is string => Boolean(value)),
          ...reservedChecksumsRef.current,
        ]);
        const accepted: Array<{ file: File; checksum: string }> = [];
        let firstError: string | null = null;
        for (const item of checked) {
          if (item.error) {
            firstError ??= item.error;
            continue;
          }
          if (!item.checksum || known.has(item.checksum)) {
            firstError ??= '이미 추가한 파일입니다.';
            continue;
          }
          known.add(item.checksum);
          accepted.push({ file: item.file, checksum: item.checksum });
        }
        if (firstError) report('material', firstError);
        if (accepted.length === 0) return;

        const temporary = accepted.map(({ file, checksum: fileChecksum }) => temporaryMaterial(file, fileChecksum));
        accepted.forEach(item => reservedChecksumsRef.current.add(item.checksum));
        for (let index = 0; index < temporary.length; index += 1) filesRef.current.set(temporary[index].id, accepted[index].file);
        setDocument(current => ({
          ...current,
          basic: { ...current.basic, materials: [...current.basic.materials, ...temporary] },
        }));
        if (!firstError) clearError('material');
        for (let index = 0; index < temporary.length; index += 1) void uploadMaterial(temporary[index].id, accepted[index].file);
      } catch (error) {
        if (isCurrent(generation) && !onErrorRef.current?.(error)) report('material', '파일을 읽을 수 없습니다.');
      } finally {
        if (isCurrent(generation)) changeCount('material', -1);
      }
    };
    materialQueueRef.current = materialQueueRef.current.then(processSelection, processSelection);
  }, [changeCount, clearError, isCurrent, report, setDocument, uploadImage, uploadMaterial]);

  const onRemoveMaterial = useCallback((id: string) => {
    controllersRef.current.get(id)?.abort();
    controllersRef.current.delete(id);
    filesRef.current.delete(id);
    setDocument(current => {
      const material = current.basic.materials.find(item => item.id === id);
      if (material?.checksum) reservedChecksumsRef.current.delete(material.checksum);
      return {
        ...current,
        basic: { ...current.basic, materials: current.basic.materials.filter(item => item.id !== id) },
      };
    });
  }, [setDocument]);

  const onRetryMaterial = useCallback((id: string) => {
    if (controllersRef.current.has(id)) return;
    const file = filesRef.current.get(id);
    if (!file) {
      report('material', '파일을 다시 선택해주세요.');
      return;
    }
    setDocument(current => ({
      ...current,
      basic: {
        ...current.basic,
        materials: current.basic.materials.map(material => material.id === id ? { ...material, status: 'uploading', error: undefined } : material),
      },
    }));
    clearError('material');
    void uploadMaterial(id, file);
  }, [clearError, report, setDocument, uploadMaterial]);

  const reset = useCallback(() => {
    generationRef.current += 1;
    controllersRef.current.forEach(controller => controller.abort());
    controllersRef.current.clear();
    filesRef.current.clear();
    reservedChecksumsRef.current.clear();
    materialQueueRef.current = Promise.resolve();
    setCounts({});
    setUploadErrors({});
  }, []);

  useEffect(() => {
    const controllers = controllersRef.current;
    const files = filesRef.current;
    const reservedChecksums = reservedChecksumsRef.current;
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      generationRef.current += 1;
      controllers.forEach(controller => controller.abort());
      controllers.clear();
      files.clear();
      reservedChecksums.clear();
      materialQueueRef.current = Promise.resolve();
    };
  }, []);

  return {
    uploading: Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0).map(([slot]) => [slot, true])) as Partial<Record<AssetSlot, boolean>>,
    uploadErrors,
    onUpload,
    onRemoveMaterial,
    onRetryMaterial,
    pending: Object.values(counts).some(count => count > 0),
    failedMaterials: document.basic.materials.some(material => material.status === 'error'),
    reset,
  };
}
