
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Autocomplete,
} from "@mui/material";


import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";

import {
  addFrame,
  addLens,
  editFrame,
  editLens,
  getFrames,
  getLenses,
  type FrameProduct,
  type LensProduct,
  type FrameInput,
  type LensInput,
} from "../services/catalogApi";

// nik - Admins manage their own optical products here.
// No product names are hardcoded into customer forms.

type CatalogTab = "frames" | "lenses";

type FrameForm = {
  brand: string;
  model: string;
  frameCode: string;
  frameStyle: string;
  description: string;
};

type LensForm = {
  company: string;
  lensName: string;
  visionType: string;
  coating: string;
  lensCode: string;
  description: string;
};

const emptyFrame: FrameForm = {
  brand: "",
  model: "",
  frameCode: "",
  frameStyle: "",
  description: "",
};

const emptyLens: LensForm = {
  company: "",
  lensName: "",
  visionType: "Single Vision",
  coating: "",
  lensCode: "",
  description: "",
};

const visionTypes = [
  "Single Vision",
  "Bifocal",
  "Progressive",
  "Trifocal",
  "Other",
];
// nik - Common lens coatings.
// Admins can also type their own coating names.
const coatingOptions = [
  "HC",
  "ARC",
  "Bluecut Green Coat",
  "Bluecut Blue Coat",,
  "NightDrive",
];

// Use null instead of empty strings for optional fields.
function optional(value: string): string | null {
  return value.trim() || null;
}

function prepareFrame(form: FrameForm): FrameInput {
  return {
    brand: form.brand.trim(),
    model: form.model.trim(),
    frameCode: optional(form.frameCode),
    frameStyle: optional(form.frameStyle),
    description: optional(form.description),
  };
}

function prepareLens(form: LensForm): LensInput {
  return {
    company: form.company.trim(),
    lensName: form.lensName.trim(),
    visionType: form.visionType.trim(),
    coating: optional(form.coating),
    lensCode: optional(form.lensCode),
    description: optional(form.description),
  };
}

export default function AdminCatalogPage() {
  const [tab, setTab] = useState<CatalogTab>("frames");
  const [frames, setFrames] = useState<FrameProduct[]>([]);
  const [lenses, setLenses] = useState<LensProduct[]>([]);

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [frameForm, setFrameForm] = useState<FrameForm>(emptyFrame);
  const [lensForm, setLensForm] = useState<LensForm>(emptyLens);

  // --------------------------------------------------
  // 1. LOAD CATALOG DATA
  // --------------------------------------------------

  const refreshCatalog = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [frameData, lensData] = await Promise.all([
        getFrames(true),
        getLenses(true),
      ]);

      setFrames(frameData);
      setLenses(lensData);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load the product catalog."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  // --------------------------------------------------
  // 2. OPEN ADD / EDIT DIALOG
  // --------------------------------------------------

  function openAddDialog() {
    setEditingId(null);
    setFrameForm({ ...emptyFrame });
    setLensForm({ ...emptyLens });
    setError("");
    setDialogOpen(true);
  }

  function openFrameEdit(frame: FrameProduct) {
    setTab("frames");
    setEditingId(frame.id);

    setFrameForm({
      brand: frame.brand,
      model: frame.model,
      frameCode: frame.frameCode ?? "",
      frameStyle: frame.frameStyle ?? "",
      description: frame.description ?? "",
    });

    setDialogOpen(true);
  }

  function openLensEdit(lens: LensProduct) {
    setTab("lenses");
    setEditingId(lens.id);

    setLensForm({
      company: lens.company,
      lensName: lens.lensName,
      visionType: lens.visionType,
      coating: lens.coating ?? "",
      lensCode: lens.lensCode ?? "",
      description: lens.description ?? "",
    });

    setDialogOpen(true);
  }

  // --------------------------------------------------
  // 3. SAVE PRODUCT
  // --------------------------------------------------

  async function saveProduct() {
    if (saving) return;

    if (tab === "frames") {
      if (
        !frameForm.brand.trim() ||
        !frameForm.model.trim()
      ) {
        setError("Frame brand and model are required.");
        return;
      }
    } else if (
      !lensForm.company.trim() ||
      !lensForm.lensName.trim() ||
      !lensForm.visionType.trim()
    ) {
      setError(
        "Lens company, lens name and vision type are required."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (tab === "frames") {
        const input = prepareFrame(frameForm);

        if (editingId) {
          await editFrame(editingId, input);
        } else {
          await addFrame(input);
        }
      } else {
        const input = prepareLens(lensForm);

        if (editingId) {
          await editLens(editingId, input);
        } else {
          await addLens(input);
        }
      }

      const action = editingId ? "updated" : "added";

      setSuccess(
        `${tab === "frames" ? "Frame" : "Lens"} ${action} successfully.`
      );

      setDialogOpen(false);
      setEditingId(null);
      await refreshCatalog();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save the product."
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // 4. ACTIVATE / DEACTIVATE
  // --------------------------------------------------

  async function toggleFrame(frame: FrameProduct) {
    const nextStatus = !frame.isActive;

    if (
      !window.confirm(
        `${nextStatus ? "Restore" : "Deactivate"} ${frame.brand} ${frame.model}?`
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await editFrame(frame.id, {
        isActive: nextStatus,
      });

      setSuccess(
        `Frame ${nextStatus ? "restored" : "deactivated"} successfully.`
      );

      await refreshCatalog();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update frame status."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleLens(lens: LensProduct) {
    const nextStatus = !lens.isActive;

    if (
      !window.confirm(
        `${nextStatus ? "Restore" : "Deactivate"} ${lens.company} ${lens.lensName}?`
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await editLens(lens.id, {
        isActive: nextStatus,
      });

      setSuccess(
        `Lens ${nextStatus ? "restored" : "deactivated"} successfully.`
      );

      await refreshCatalog();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update lens status."
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // 5. FILTER PRODUCTS
  // --------------------------------------------------

  const filteredFrames = frames.filter((frame) => {
    if (!showInactive && !frame.isActive) return false;

    const text = [
      frame.brand,
      frame.model,
      frame.frameCode,
      frame.frameStyle,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(search.trim().toLowerCase());
  });

  const filteredLenses = lenses.filter((lens) => {
    if (!showInactive && !lens.isActive) return false;

    const text = [
      lens.company,
      lens.lensName,
      lens.visionType,
      lens.coating,
      lens.lensCode,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(search.trim().toLowerCase());
  });

  function changeTab(next: CatalogTab) {
    setTab(next);
    setSearch("");
    setError("");
    setSuccess("");
  }

  // --------------------------------------------------
  // 6. FORM FIELD HELPERS
  // --------------------------------------------------

  function frameField(
    name: keyof FrameForm,
    label: string,
    required = false
  ) {
    return (
      <TextField
        fullWidth
        label={label}
        required={required}
        value={frameForm[name]}
        disabled={saving}
        onChange={(event) =>
          setFrameForm((previous) => ({
            ...previous,
            [name]: event.target.value,
          }))
        }
      />
    );
  }

  function lensField(
    name: keyof LensForm,
    label: string,
    required = false
  ) {
    return (
      <TextField
        fullWidth
        label={label}
        required={required}
        value={lensForm[name]}
        disabled={saving}
        onChange={(event) =>
          setLensForm((previous) => ({
            ...previous,
            [name]: event.target.value,
          }))
        }
      />
    );
  }

  // --------------------------------------------------
  // 7. MAIN PAGE
  // --------------------------------------------------

  return (
    <Stack spacing={3}>
      {/* PAGE TITLE */}
      <Box>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700 }}
        >
          Product Catalog
        </Typography>

        <Typography
          color="text.secondary"
          sx={{ mt: 1 }}
        >
          Manage frame brands, models, lens companies,
          vision types and coatings from one place.
        </Typography>
      </Box>

      <Alert severity="info">
        Development catalog — products are stored in
        PostgreSQL. Admin authentication is required
        before production deployment.
      </Alert>

      {/* SUCCESS AND ERROR FEEDBACK */}
      {success && (
        <Alert
          severity="success"
          onClose={() => setSuccess("")}
        >
          {success}
        </Alert>
      )}

      {error && !dialogOpen && (
        <Alert
          severity="error"
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      {/* CATALOG CARD */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={3}>
            <Tabs
              value={tab}
              onChange={(_, value: CatalogTab) =>
                changeTab(value)
              }
            >
              <Tab
                label={`Frames (${frames.length})`}
                value="frames"
              />
              <Tab
                label={`Lenses (${lenses.length})`}
                value="lenses"
              />
            </Tabs>

            <Divider />

            {/* SEARCH AND ACTIONS */}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 5 }}>
                <TextField
                  fullWidth
                  label={
                    tab === "frames"
                      ? "Search Frames"
                      : "Search Lenses"
                  }
                  placeholder="Search brand, model, company..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </Grid>

              <Grid size={{ xs: 12, md: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showInactive}
                      onChange={(_, checked) =>
                        setShowInactive(checked)
                      }
                    />
                  }
                  label="Show inactive"
                  sx={{ mt: 1 }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ justifyContent: "flex-end" }}
                >
                  <Tooltip title="Refresh catalog">
                    <span>
                      <IconButton
                        onClick={() =>
                          void refreshCatalog()
                        }
                        disabled={loading || saving}
                      >
                        <RefreshOutlined />
                      </IconButton>
                    </span>
                  </Tooltip>

                  <Button
                    variant="contained"
                    startIcon={<AddOutlined />}
                    onClick={openAddDialog}
                    disabled={saving}
                  >
                    {tab === "frames"
                      ? "Add Frame"
                      : "Add Lens"}
                  </Button>
                </Stack>
              </Grid>
            </Grid>

            {/* LOADING */}
            {loading && (
              <Stack
                direction="row"
                spacing={2}
                sx={{ alignItems: "center", py: 3 }}
              >
                <CircularProgress size={22} />
                <Typography color="text.secondary">
                  Loading products...
                </Typography>
              </Stack>
            )}

            {/* FRAME LIST */}
            {!loading && tab === "frames" && (
              <Stack spacing={2}>
                {filteredFrames.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: "center",
                      py: 5,
                    }}
                  >
                    <Inventory2Outlined
                      color="disabled"
                      sx={{ fontSize: 44 }}
                    />
                    <Typography sx={{ mt: 1 }}>
                      No matching frames found.
                    </Typography>
                  </Box>
                ) : (
                  filteredFrames.map((frame) => (
                    <Card
                      key={frame.id}
                      variant="outlined"
                    >
                      <CardContent>
                        <Grid
                          container
                          spacing={2}
                          sx={{ alignItems: "center" }}
                        >
                          <Grid size={{ xs: 12, md: 7 }}>
                            <Typography
                              sx={{ fontWeight: 700 }}
                            >
                              {frame.brand} — {frame.model}
                            </Typography>

                            <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                              {[
                                frame.frameCode,
                                frame.frameStyle,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "No additional details"}
                            </Typography>

                            {frame.description && (
                              <Typography
                                variant="body2"
                                sx={{ mt: 1 }}
                              >
                                {frame.description}
                              </Typography>
                            )}
                          </Grid>

                          <Grid size={{ xs: 12, md: 2 }}>
                            <Chip
                              size="small"
                              color={
                                frame.isActive
                                  ? "success"
                                  : "default"
                              }
                              label={
                                frame.isActive
                                  ? "Active"
                                  : "Inactive"
                              }
                            />
                          </Grid>

                          <Grid size={{ xs: 12, md: 3 }}>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{
                                justifyContent: {
                                  xs: "flex-start",
                                  md: "flex-end",
                                },
                              }}
                            >
                              <Button
                                size="small"
                                startIcon={<EditOutlined />}
                                onClick={() =>
                                  openFrameEdit(frame)
                                }
                                disabled={saving}
                              >
                                Edit
                              </Button>

                              <Button
                                size="small"
                                color={
                                  frame.isActive
                                    ? "warning"
                                    : "success"
                                }
                                onClick={() =>
                                  void toggleFrame(frame)
                                }
                                disabled={saving}
                              >
                                {frame.isActive
                                  ? "Deactivate"
                                  : "Restore"}
                              </Button>
                            </Stack>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))
                )}
              </Stack>
            )}

            {/* LENS LIST */}
            {!loading && tab === "lenses" && (
              <Stack spacing={2}>
                {filteredLenses.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: "center",
                      py: 5,
                    }}
                  >
                    <Inventory2Outlined
                      color="disabled"
                      sx={{ fontSize: 44 }}
                    />
                    <Typography sx={{ mt: 1 }}>
                      No matching lenses found.
                    </Typography>
                  </Box>
                ) : (
                  filteredLenses.map((lens) => (
                    <Card
                      key={lens.id}
                      variant="outlined"
                    >
                      <CardContent>
                        <Grid
                          container
                          spacing={2}
                          sx={{ alignItems: "center" }}
                        >
                          <Grid size={{ xs: 12, md: 7 }}>
                            <Typography
                              sx={{ fontWeight: 700 }}
                            >
                              {lens.company} — {lens.lensName}
                            </Typography>

                            <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                              {[
                                lens.visionType,
                                lens.coating,
                                lens.lensCode,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </Typography>

                            {lens.description && (
                              <Typography
                                variant="body2"
                                sx={{ mt: 1 }}
                              >
                                {lens.description}
                              </Typography>
                            )}
                          </Grid>

                          <Grid size={{ xs: 12, md: 2 }}>
                            <Chip
                              size="small"
                              color={
                                lens.isActive
                                  ? "success"
                                  : "default"
                              }
                              label={
                                lens.isActive
                                  ? "Active"
                                  : "Inactive"
                              }
                            />
                          </Grid>

                          <Grid size={{ xs: 12, md: 3 }}>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{
                                justifyContent: {
                                  xs: "flex-start",
                                  md: "flex-end",
                                },
                              }}
                            >
                              <Button
                                size="small"
                                startIcon={<EditOutlined />}
                                onClick={() =>
                                  openLensEdit(lens)
                                }
                                disabled={saving}
                              >
                                Edit
                              </Button>

                              <Button
                                size="small"
                                color={
                                  lens.isActive
                                    ? "warning"
                                    : "success"
                                }
                                onClick={() =>
                                  void toggleLens(lens)
                                }
                                disabled={saving}
                              >
                                {lens.isActive
                                  ? "Deactivate"
                                  : "Restore"}
                              </Button>
                            </Stack>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* ADD / EDIT DIALOG */}
      <Dialog
        open={dialogOpen}
        onClose={(_, reason) => {
          if (
            !saving &&
            reason !== "backdropClick"
          ) {
            setDialogOpen(false);
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editingId ? "Edit" : "Add"}{" "}
          {tab === "frames" ? "Frame" : "Lens"}
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && (
              <Alert severity="error">
                {error}
              </Alert>
            )}

            {tab === "frames" ? (
              <>
                {frameField("brand", "Frame Brand", true)}
                {frameField("model", "Frame Model", true)}
                {frameField("frameCode", "Frame Code")}
                {frameField("frameStyle", "Frame Style")}

                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Description"
                  value={frameForm.description}
                  onChange={(event) =>
                    setFrameForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                />
              </>
            ) : (
              <>
                {lensField(
                  "company",
                  "Lens Company",
                  true
                )}

                {lensField(
                  "lensName",
                  "Lens Name / Model",
                  true
                )}

                <TextField
                  fullWidth
                  select
                  label="Vision Type"
                  value={
                    visionTypes.includes(
                      lensForm.visionType
                    )
                      ? lensForm.visionType
                      : "Other"
                  }
                  onChange={(event) =>
                    setLensForm((previous) => ({
                      ...previous,
                      visionType: event.target.value,
                    }))
                  }
                >
                  {visionTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>

                {lensForm.visionType === "Other" ||
                !visionTypes.includes(
                  lensForm.visionType
                ) ? (
                  <TextField
                    fullWidth
                    label="Custom Vision Type"
                    value={
                      lensForm.visionType === "Other"
                        ? ""
                        : lensForm.visionType
                    }
                    onChange={(event) =>
                      setLensForm((previous) => ({
                        ...previous,
                        visionType:
                          event.target.value || "Other",
                      }))
                    }
                  />
                ) : null}

                {/* Searchable coating dropdown with custom entry */}
<Autocomplete
  freeSolo
  fullWidth
  options={coatingOptions}
  value={lensForm.coating}
  inputValue={lensForm.coating}
  disabled={saving}
  onInputChange={(_, value, reason) => {
    if (
      reason === "input" ||
      reason === "clear"
    ) {
      setLensForm((previous) => ({
        ...previous,
        coating: value,
      }));
    }
  }}
  onChange={(_, value) => {
    setLensForm((previous) => ({
      ...previous,
      coating: value ?? "",
    }));
  }}
  renderInput={(params) => (
    <TextField
      {...params}
      label="Coating / Treatment"
      placeholder="Select or type a coating"
      helperText="Select an existing option or type a custom coating."
    />
  )}
/>

                {lensField(
                  "lensCode",
                  "Lens Product Code"
                )}

                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Description"
                  value={lensForm.description}
                  onChange={(event) =>
                    setLensForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                />
              </>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={() => void saveProduct()}
            disabled={saving}
            startIcon={
              saving ? (
                <CircularProgress
                  size={16}
                  color="inherit"
                />
              ) : undefined
            }
          >
            {saving ? "Saving..." : "Save Product"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
