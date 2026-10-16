
/**
 * Frame and Lens Catalog API
 *
 * nik - Keep API calls separate from the admin interface.
 * Product data comes from PostgreSQL through Express.
 */

const BASE_URL = "/api/catalog";

export type FrameProduct = {
  id: string;
  shopId: string;
  brand: string;
  model: string;
  frameCode: string | null;
  frameStyle: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LensProduct = {
  id: string;
  shopId: string;
  company: string;
  lensName: string;
  visionType: string;
  coating: string | null;
  lensCode: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FrameInput = {
  brand: string;
  model: string;
  frameCode: string | null;
  frameStyle: string | null;
  description: string | null;
};

export type LensInput = {
  company: string;
  lensName: string;
  visionType: string;
  coating: string | null;
  lensCode: string | null;
  description: string | null;
};

export type FrameChanges = Partial<FrameInput> & {
  isActive?: boolean;
};

export type LensChanges = Partial<LensInput> & {
  isActive?: boolean;
};

type ApiResult<T> = {
  success: boolean;
  message?: string;
  data: T;
};

// Read API responses safely and report backend errors.
async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options?.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options?.headers,
    },
  });

  const result = (await response
    .json()
    .catch(() => null)) as ApiResult<T> | null;

  if (!response.ok || !result?.success) {
    throw new Error(
      result?.message ??
        `Catalog request failed (${response.status}).`
    );
  }

  return result.data;
}

// --------------------------------------------------
// FRAME REQUESTS
// --------------------------------------------------

export function getFrames(
  includeInactive = true
): Promise<FrameProduct[]> {
  return request<FrameProduct[]>(
    `/frames?includeInactive=${includeInactive}`
  );
}

export function addFrame(
  input: FrameInput
): Promise<FrameProduct> {
  return request<FrameProduct>("/frames", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function editFrame(
  id: string,
  changes: FrameChanges
): Promise<FrameProduct> {
  return request<FrameProduct>(
    `/frames/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(changes),
    }
  );
}

// --------------------------------------------------
// LENS REQUESTS
// --------------------------------------------------

export function getLenses(
  includeInactive = true
): Promise<LensProduct[]> {
  return request<LensProduct[]>(
    `/lenses?includeInactive=${includeInactive}`
  );
}

export function addLens(
  input: LensInput
): Promise<LensProduct> {
  return request<LensProduct>("/lenses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function editLens(
  id: string,
  changes: LensChanges
): Promise<LensProduct> {
  return request<LensProduct>(
    `/lenses/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(changes),
    }
  );
}
