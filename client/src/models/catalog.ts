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
