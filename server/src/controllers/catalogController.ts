import type { Request, Response } from "express";

import {
  catalogIdSchema,
  catalogListSchema,
  frameCreateSchema,
  frameUpdateSchema,
  lensCreateSchema,
  lensUpdateSchema,
} from "../validators/catalogValidator";

import {
  listFrames,
  createFrame,
  updateFrame,
  listLenses,
  createLens,
  updateLens,
  deleteFrame,
  deleteLens,
} from "../services/catalogService";

export async function removeFrame(req: Request, res: Response) {
  const id = catalogIdSchema.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ success: false, message: "Invalid frame ID." });
    return;
  }
  if (!(await deleteFrame(id.data))) {
    res.status(404).json({ success: false, message: "Frame not found." });
    return;
  }
  res.json({ success: true, message: "Frame deleted successfully.", data: { id: id.data } });
}

export async function removeLens(req: Request, res: Response) {
  const id = catalogIdSchema.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ success: false, message: "Invalid lens ID." });
    return;
  }
  if (!(await deleteLens(id.data))) {
    res.status(404).json({ success: false, message: "Lens not found." });
    return;
  }
  res.json({ success: true, message: "Lens deleted successfully.", data: { id: id.data } });
}

// Keep response formatting consistent with
// the existing customer controllers.

// FRAMES

export async function getFrames(req: Request, res: Response) {
  const parsed = catalogListSchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid frame search parameters.",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const frames = await listFrames(parsed.data);

  res.status(200).json({
    success: true,
    count: frames.length,
    data: frames,
  });
}

export async function addFrame(req: Request, res: Response) {
  const parsed = frameCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid frame information.",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const frame = await createFrame(parsed.data);

  res.status(201).json({
    success: true,
    message: "Frame added successfully.",
    data: frame,
  });
}

export async function editFrame(req: Request, res: Response) {
  const id = catalogIdSchema.safeParse(req.params.id);
  const parsed = frameUpdateSchema.safeParse(req.body);

  if (!id.success) {
    res.status(400).json({
      success: false,
      message: "Invalid frame ID.",
    });
    return;
  }

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid frame changes.",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const frame = await updateFrame(id.data, parsed.data);

  if (!frame) {
    res.status(404).json({
      success: false,
      message: "Frame not found.",
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "Frame updated successfully.",
    data: frame,
  });
}

// LENSES

export async function getLenses(req: Request, res: Response) {
  const parsed = catalogListSchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid lens search parameters.",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const lenses = await listLenses(parsed.data);

  res.status(200).json({
    success: true,
    count: lenses.length,
    data: lenses,
  });
}

export async function addLens(req: Request, res: Response) {
  const parsed = lensCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid lens information.",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const lens = await createLens(parsed.data);

  res.status(201).json({
    success: true,
    message: "Lens added successfully.",
    data: lens,
  });
}

export async function editLens(req: Request, res: Response) {
  const id = catalogIdSchema.safeParse(req.params.id);
  const parsed = lensUpdateSchema.safeParse(req.body);

  if (!id.success) {
    res.status(400).json({
      success: false,
      message: "Invalid lens ID.",
    });
    return;
  }

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid lens changes.",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const lens = await updateLens(id.data, parsed.data);

  if (!lens) {
    res.status(404).json({
      success: false,
      message: "Lens not found.",
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "Lens updated successfully.",
    data: lens,
  });
}
