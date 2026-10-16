
/**
 * Optical CRM — Admin Product Catalog
 *
 * nik - Manage optical frames and lenses.
 * Add, edit, deactivate and restore catalog products.
 *
 * Existing customer purchases keep their historical
 * product names even when catalog items become inactive.
 */

import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Autocomplete,
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
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";

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

// -----------------------------------------------------
// 1. FORM TYPES
// -----------------------------------------------------

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

// nik - These are suggestions, not mandatory choices.
// Staff may type a custom vision type or coating.

const visionTypes = [
  "Single Vision",
  "Bifocal",
  "Progressive",
  "Trifocal",
  "Other",
];

const coatingOptions = [
  "HC",
  "ARC",
  "Bluecut Green Coat",
  "Bluecut Blue Coat",
  "NightDrive",
];

// -----------------------------------------------------
// 2. INPUT HELPERS
// -----------------------------------------------------

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

// -----------------------------------------------------
// 3. MAIN CATALOG PAGE
// -----------------------------------------------------

export default function AdminCatalogPage() {
  const [tab, setTab] = useState<CatalogTab>("frames");

  const [frames, setFrames] = useState<FrameProduct[]>([]);
  const [lenses, setLenses] = useState<LensProduct[]>([]);

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [frameForm, setFrameForm] = useState<FrameForm>(emptyFrame);
  const [lensForm, setLensForm] = useState<LensForm>(emptyLens);

  // ---------------------------------------------------
  // 4. FETCH PRODUCT DATA
  // ---------------------------------------------------

  // nik - Load inactive products too, so admins can
  // reactivate them without losing existing records.

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
          : "Unable to load product catalog."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // nik - Begin loading asynchronously instead of setting state in the effect.
    void Promise.resolve().then(() => refreshCatalog());
  }, [refreshCatalog]);

  // ---------------------------------------------------
  // 5. ADD AND EDIT DIALOGS
  // ---------------------------------------------------

  function openAddDialog() {
    setEditingId(null);
    setFrameForm({ ...emptyFrame });
    setLensForm({ ...emptyLens });
    setError("");
    setSuccess("");
    setDialogOpen(true);
  }

  function openFrameEdit(frame: FrameProduct) {
    setTab("frames");
    setEditingId(frame.id);
    setError("");

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
    setError("");

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

  function closeDialog() {
    if (saving) return;

    setDialogOpen(false);
    setError("");
  }

  // ---------------------------------------------------
  // 6. SAVE PRODUCT
  // ---------------------------------------------------

  async function saveProduct() {
    if (saving) return;

    if (
      tab === "frames" &&
      (!frameForm.brand.trim() || !frameForm.model.trim())
    ) {
      setError("Frame brand and model are required.");
      return;
    }

    if (
      tab === "lenses" &&
      (
        !lensForm.company.trim() ||
        !lensForm.lensName.trim() ||
        !lensForm.visionType.trim()
      )
    ) {
      setError(
        "Lens company, name and vision type are required."
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

      const message = editingId
        ? "Product updated successfully."
        : "Product added successfully.";

      // Refresh before closing the dialog so the
      // catalog list reflects the saved product.
      await refreshCatalog();

      setDialogOpen(false);
      setEditingId(null);
      setSuccess(message);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save product."
      );
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------
  // 7. ACTIVATE / DEACTIVATE PRODUCTS
  // ---------------------------------------------------

  async function toggleFrame(frame: FrameProduct) {
    if (saving) return;

    const nextStatus = !frame.isActive;

    const action = nextStatus ? "Restore" : "Deactivate";

    if (
      !window.confirm(
        `${action} ${frame.brand} ${frame.model}?`
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

      await refreshCatalog();

      setSuccess(
        nextStatus
          ? "Frame restored successfully."
          : "Frame deactivated successfully."
      );
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
    if (saving) return;

    const nextStatus = !lens.isActive;

    const action = nextStatus ? "Restore" : "Deactivate";

    if (
      !window.confirm(
        `${action} ${lens.company} ${lens.lensName}?`
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

      await refreshCatalog();

      setSuccess(
        nextStatus
          ? "Lens restored successfully."
          : "Lens deactivated successfully."
      );
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

  // ---------------------------------------------------
  // 8. FILTER AND COUNT PRODUCTS
  // ---------------------------------------------------

  const query = search.trim().toLowerCase();

  const filteredFrames = frames.filter((frame) => {
    if (!showInactive && !frame.isActive) return false;

    const text = [
      frame.brand,
      frame.model,
      frame.frameCode,
      frame.frameStyle,
      frame.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(query);
  });

  const filteredLenses = lenses.filter((lens) => {
    if (!showInactive && !lens.isActive) return false;

    const text = [
      lens.company,
      lens.lensName,
      lens.visionType,
      lens.coating,
      lens.lensCode,
      lens.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(query);
  });

  const activeFrames = frames.filter(
    (frame) => frame.isActive
  ).length;

  const activeLenses = lenses.filter(
    (lens) => lens.isActive
  ).length;

  const visibleProducts =
    tab === "frames" ? filteredFrames.length : filteredLenses.length;

  function changeTab(next: CatalogTab) {
    setTab(next);
    setSearch("");
    setError("");
    setSuccess("");
  }

  // ---------------------------------------------------
  // 9. REUSABLE FORM INPUTS
  // ---------------------------------------------------

  function frameField(
    key: keyof FrameForm,
    label: string,
    required = false
  ) {
    return (
      <TextField
        fullWidth
        required={required}
        label={label}
        value={frameForm[key]}
        disabled={saving}
        onChange={(event) => {
          setFrameForm((previous) => ({
            ...previous,
            [key]: event.target.value,
          }));
        }}
      />
    );
  }

  function lensField(
    key: keyof LensForm,
    label: string,
    required = false
  ) {
    return (
      <TextField
        fullWidth
        required={required}
        label={label}
        value={lensForm[key]}
        disabled={saving}
        onChange={(event) => {
          setLensForm((previous) => ({
            ...previous,
            [key]: event.target.value,
          }));
        }}
      />
    );
  }

  // ---------------------------------------------------
  // 10. MAIN UI
  // ---------------------------------------------------

  return (
    <Box sx={{ maxWidth: 1250, mx: "auto", pb: 5 }}>
      <Stack spacing={2.5}>
        {/* PAGE HEADER */}

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { sm: "center" },
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{ fontWeight: 800 }}
            >
              Product Catalog
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.75 }}
            >
              Manage frames and lenses used in customer
              purchase records.
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={openAddDialog}
            disabled={saving}
            sx={{
              borderRadius: 2,
              alignSelf: {
                xs: "stretch",
                sm: "auto",
              },
            }}
          >
            {tab === "frames" ? "Add Frame" : "Add Lens"}
          </Button>
        </Stack>

        {/* AUTHENTICATION NOTICE */}

        <Alert severity="info">
          Development catalog. Restrict product management
          to authenticated admins before production deployment.
        </Alert>

        {/* SAVE FEEDBACK */}

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

        {/* -----------------------------------------
            CATALOG TABS AND CONTROLS
        ----------------------------------------- */}

        <Card
          variant="outlined"
          sx={{ borderRadius: 3 }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Tabs
              value={tab}
              onChange={(_, next: CatalogTab) =>
                changeTab(next)
              }
              variant="scrollable"
              scrollButtons="auto"
              sx={{ mb: 2 }}
            >
              <Tab
                value="frames"
                label={`Frames (${frames.length})`}
              />

              <Tab
                value="lenses"
                label={`Lenses (${lenses.length})`}
              />
            </Tabs>

            {/* PRODUCT SUMMARY */}

            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ flexWrap: "wrap", mb: 2.5 }}
            >
              <Chip
                label={`${activeFrames} Active Frames`}
                size="small"
                color="primary"
                variant="outlined"
              />

              <Chip
                label={`${activeLenses} Active Lenses`}
                size="small"
                color="primary"
                variant="outlined"
              />

              <Chip
                label={`${visibleProducts} Shown`}
                size="small"
                variant="outlined"
              />
            </Stack>

            {/* SEARCH AND FILTERS */}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 7 }}>
                <TextField
                  fullWidth
                  label={
                    tab === "frames"
                      ? "Search Frames"
                      : "Search Lenses"
                  }
                  placeholder="Brand, model, code, coating..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchOutlined color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: search ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            aria-label="Clear catalog search"
                            onClick={() => setSearch("")}
                          >
                            <CloseOutlined fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : undefined,
                    },
                  }}
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

              <Grid size={{ xs: 12, md: 2 }}>
                <Tooltip title="Refresh product catalog">
                  <span>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<RefreshOutlined />}
                      disabled={loading || saving}
                      onClick={() =>
                        void refreshCatalog()
                      }
                      sx={{ height: 54 }}
                    >
                      Refresh
                    </Button>
                  </span>
                </Tooltip>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* -----------------------------------------
            PRODUCT LIST
        ----------------------------------------- */}

        {loading ? (
          <Card variant="outlined">
            <CardContent>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center", py: 3 }}
              >
                <CircularProgress size={22} />

                <Typography color="text.secondary">
                  Loading catalog...
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={1.5}>
            {/* FRAMES */}

            {tab === "frames" &&
              filteredFrames.map((frame) => (
                <Card
                  key={frame.id}
                  variant="outlined"
                  sx={{ borderRadius: 2.5 }}
                >
                  <CardContent
                    sx={{
                      p: 2.25,
                      "&:last-child": { pb: 2.25 },
                    }}
                  >
                    <Grid
                      container
                      spacing={2}
                      sx={{ alignItems: "center" }}
                    >
                      <Grid size={{ xs: 12, md: 7 }}>
                        <Stack spacing={0.75}>
                          <Typography
                            variant="subtitle1"
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
                              .join(" · ") ||
                              "No additional details"}
                          </Typography>

                          {frame.description && (
                            <Typography variant="body2">
                              {frame.description}
                            </Typography>
                          )}
                        </Stack>
                      </Grid>

                      <Grid size={{ xs: 12, md: 2 }}>
                        <Chip
                          size="small"
                          color={
                            frame.isActive
                              ? "success"
                              : "default"
                          }
                          variant="outlined"
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
                            disabled={saving}
                            onClick={() =>
                              openFrameEdit(frame)
                            }
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
                            disabled={saving}
                            onClick={() =>
                              void toggleFrame(frame)
                            }
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
              ))}

            {/* LENSES */}

            {tab === "lenses" &&
              filteredLenses.map((lens) => (
                <Card
                  key={lens.id}
                  variant="outlined"
                  sx={{ borderRadius: 2.5 }}
                >
                  <CardContent
                    sx={{
                      p: 2.25,
                      "&:last-child": { pb: 2.25 },
                    }}
                  >
                    <Grid
                      container
                      spacing={2}
                      sx={{ alignItems: "center" }}
                    >
                      <Grid size={{ xs: 12, md: 7 }}>
                        <Stack spacing={0.75}>
                          <Typography
                            variant="subtitle1"
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
                            <Typography variant="body2">
                              {lens.description}
                            </Typography>
                          )}
                        </Stack>
                      </Grid>

                      <Grid size={{ xs: 12, md: 2 }}>
                        <Chip
                          size="small"
                          color={
                            lens.isActive
                              ? "success"
                              : "default"
                          }
                          variant="outlined"
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
                            disabled={saving}
                            onClick={() =>
                              openLensEdit(lens)
                            }
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
                            disabled={saving}
                            onClick={() =>
                              void toggleLens(lens)
                            }
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
              ))}

            {/* EMPTY RESULT */}

            {visibleProducts === 0 && (
              <Card variant="outlined">
                <CardContent
                  sx={{
                    textAlign: "center",
                    py: 6,
                  }}
                >
                  <Inventory2Outlined
                    color="disabled"
                    sx={{ fontSize: 48 }}
                  />

                  <Typography
                    variant="h6"
                    sx={{ mt: 1, fontWeight: 700 }}
                  >
                    No Products Found
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.75, mb: 2 }}
                  >
                    Try a different search or add
                    a new catalog product.
                  </Typography>

                  <Button
                    variant="outlined"
                    onClick={openAddDialog}
                    startIcon={<AddOutlined />}
                  >
                    Add Product
                  </Button>
                </CardContent>
              </Card>
            )}
          </Stack>
        )}

        {/* -----------------------------------------
            ADD / EDIT PRODUCT DIALOG
        ----------------------------------------- */}

        <Dialog
          open={dialogOpen}
          onClose={(_, reason) => {
            if (!saving && reason !== "backdropClick") {
              closeDialog();
            }
          }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle sx={{ fontWeight: 700 }}>
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
                    disabled={saving}
                    onChange={(event) => {
                      setFrameForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }));
                    }}
                  />
                </>
              ) : (
                <>
                  {lensField("company", "Lens Company", true)}
                  {lensField("lensName", "Lens Name / Model", true)}

                  {/* Searchable vision type with custom input */}
                  <Autocomplete<string, false, false, true>
                    freeSolo
                    fullWidth
                    openOnFocus
                    forcePopupIcon
                    clearOnBlur={false}
                    options={visionTypes}
                    value={lensForm.visionType}
                    inputValue={lensForm.visionType}
                    disabled={saving}
                    onInputChange={(_, value, reason) => {
                      if (
                        reason === "input" ||
                        reason === "clear"
                      ) {
                        setLensForm((previous) => ({
                          ...previous,
                          visionType: value,
                        }));
                      }
                    }}
                    onChange={(_, value) => {
                      setLensForm((previous) => ({
                        ...previous,
                        visionType: value ?? "",
                      }));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        required
                        label="Vision Type"
                        placeholder="Select or type"
                        helperText="Choose a type or enter your own."
                      />
                    )}
                  />

                  {/* Searchable coating dropdown */}
                  <Autocomplete<string, false, false, true>
                    freeSolo
                    fullWidth
                    openOnFocus
                    forcePopupIcon
                    clearOnBlur={false}
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
                        placeholder="Select or type"
                        helperText="Catalog suggestions or custom coating."
                      />
                    )}
                  />

                  {lensField("lensCode", "Lens Product Code")}

                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Description"
                    value={lensForm.description}
                    disabled={saving}
                    onChange={(event) => {
                      setLensForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }));
                    }}
                  />
                </>
              )}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 2 }}>
            <Button
              variant="outlined"
              onClick={closeDialog}
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
    </Box>
  );
}
