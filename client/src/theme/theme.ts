import { createTheme, type Theme } from "@mui/material/styles";

// Central theme generator for Optical CRM supporting both light and dark modes.
export function getAppTheme(mode: "light" | "dark" = "light"): Theme {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? "#3B82F6" : "#2563EB",
        ...(isDark && { light: "#93C5FD", contrastText: "#0B1120" }),
      },
      background: {
        default: isDark ? "#0B1120" : "#F5F7FB",
        paper: isDark ? "#1E293B" : "#FFFFFF",
      },
      text: {
        primary: isDark ? "#F8FAFC" : "#17243B",
        secondary: isDark ? "#94A3B8" : "#64748B",
        ...(isDark && { disabled: "#B8C4D6" }),
      },
      divider: isDark ? "rgba(255, 255, 255, 0.12)" : "#E7EBF2",
      action: {
        ...(isDark && { disabled: "#B8C4D6" }),
        hover: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
        selected: isDark ? "rgba(59, 130, 246, 0.18)" : "rgba(37, 99, 235, 0.08)",
      },
    },

    shape: {
      borderRadius: 12,
    },

    typography: {
      fontFamily: "Inter, Arial, sans-serif",
      h5: {
        fontWeight: 700,
        fontSize: "clamp(1.2rem, 1rem + 0.6vw, 1.5rem)",
      },
      h4: { fontWeight: 700, fontSize: "clamp(1.5rem, 1.2rem + 1vw, 2.125rem)" },
      h6: {
        fontWeight: 700,
      },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: (currentTheme) => ({
          html: { minWidth: 0, scrollPaddingTop: 80, colorScheme: mode },
          body: { minWidth: 0 },
          "#root": { width: "100%", minWidth: 0, minHeight: "100dvh" },
          "img, svg": { maxWidth: "100%" },
          ...(isDark && {
            ".recharts-cartesian-axis-tick-value, .recharts-pie-label-text": {
              fill: currentTheme.palette.text.secondary,
            },
            // Recharts sets series colors inline; use readable text while retaining swatches.
            ".recharts-legend-item-text": {
              color: `${currentTheme.palette.text.primary} !important`,
            },
            ".recharts-default-tooltip": { color: theme.palette.text.primary },
            ".recharts-default-tooltip .recharts-tooltip-item": {
              color: `${theme.palette.text.primary} !important`,
            },
          }),
        }),
      },
      MuiGrid: { styleOverrides: { root: { minWidth: 0 } } },
      MuiCardContent: {
        styleOverrides: {
          root: ({ theme }) => ({
            [theme.breakpoints.down("sm")]: { padding: 16, "&:last-child": { paddingBottom: 16 } },
          }),
        },
      },
      MuiStack: { styleOverrides: { root: { minWidth: 0 } } },
      MuiTypography: {
        styleOverrides: {
          root: ({ theme, ownerState }) => ({
            overflowWrap: "anywhere",
            ...(isDark && ownerState.color === "primary" && { color: theme.palette.primary.light }),
          }),
        },
      },
      MuiFormControl: { styleOverrides: { root: { minWidth: 0, maxWidth: "100%" } } },
      MuiFormHelperText: { styleOverrides: { root: { overflowWrap: "anywhere" } } },
      MuiAlert: {
        styleOverrides: {
          root: { minWidth: 0 },
          message: { minWidth: 0, overflowWrap: "anywhere" },
        },
      },
      MuiMenuItem: { styleOverrides: { root: { whiteSpace: "normal", overflowWrap: "anywhere" } } },
      MuiAutocomplete: {
        styleOverrides: {
          root: { minWidth: 0, maxWidth: "100%" },
          option: { overflowWrap: "anywhere" },
          popper: { maxWidth: "calc(100vw - 24px)" },
        },
      },
      MuiTableContainer: {
        defaultProps: { tabIndex: 0, role: "region", "aria-label": "Scrollable data table" },
        styleOverrides: {
          root: {
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            overflowX: "auto",
            overscrollBehaviorX: "contain",
          },
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          toolbar: { flexWrap: "wrap", paddingLeft: 8, paddingRight: 8, rowGap: 4 },
          spacer: { flex: "1 1 0%" },
          selectLabel: { marginTop: 8, marginBottom: 8 },
          displayedRows: { marginTop: 8, marginBottom: 8 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            minWidth: 0,
            maxHeight: "calc(100dvh - 64px)",
            backgroundColor: theme.palette.background.paper,
            backgroundImage: "none",
            [theme.breakpoints.down("sm")]: {
              margin: 12,
              width: "calc(100% - 24px)",
              maxHeight: "calc(100dvh - 24px)",
            },
            "&.MuiDialog-paperFullScreen": {
              margin: 0,
              width: "100%",
              maxWidth: "100%",
              maxHeight: "100dvh",
              height: "100dvh",
              borderRadius: 0,
            },
          }),
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: ({ theme }) => ({
            [theme.breakpoints.down("sm")]: { padding: "16px", fontSize: "1.15rem" },
          }),
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: ({ theme }) => ({
            minHeight: 0,
            overscrollBehavior: "contain",
            [theme.breakpoints.down("sm")]: { padding: 16 },
          }),
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            flexShrink: 0,
            flexWrap: "wrap",
            gap: 8,
            padding: 16,
            "& > :not(style) ~ :not(style)": { marginLeft: 0 },
          },
        },
      },
      MuiTabs: {
        defaultProps: {
          variant: "scrollable",
          scrollButtons: "auto",
          allowScrollButtonsMobile: true,
        },
        styleOverrides: { root: { minWidth: 0, maxWidth: "100%" } },
      },
      MuiTab: {
        styleOverrides: {
          root: ({ theme }) => ({
            minHeight: 44,
            ...(isDark && { "&.Mui-selected": { color: theme.palette.primary.light } }),
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: ({ theme, ownerState }) =>
            isDark &&
            ownerState.variant === "outlined" &&
            (ownerState.color === "primary" || ownerState.color === "error")
              ? { color: theme.palette[ownerState.color].light }
              : {},
        },
      },
      MuiLink: {
        styleOverrides: {
          root: ({ theme, ownerState }) =>
            isDark && ownerState.color === "primary" ? { color: theme.palette.primary.light } : {},
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: ({ theme }) =>
            isDark ? { "&.Mui-focused": { color: theme.palette.primary.light } } : {},
        },
      },
      MuiPaginationItem: {
        styleOverrides: { root: { "@media (pointer: coarse)": { minWidth: 44, height: 44 } } },
      },
      MuiToggleButtonGroup: { styleOverrides: { root: { flexWrap: "wrap", maxWidth: "100%" } } },
      MuiToggleButton: {
        styleOverrides: {
          root: ({ theme, ownerState }) => ({
            whiteSpace: "normal",
            minHeight: 40,
            "@media (pointer: coarse)": { minHeight: 44 },
            ...(isDark &&
              ownerState.color === "primary" && {
                "&.Mui-selected": { color: theme.palette.primary.light },
              }),
          }),
        },
      },
      MuiButtonBase: {
        styleOverrides: {
          root: { "&.Mui-focusVisible": { outline: "2px solid #2563EB", outlineOffset: 2 } },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { "@media (pointer: coarse)": { minWidth: 44, minHeight: 44 } } },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: ({ theme }) => ({
            textTransform: "none",
            borderRadius: 10,
            fontWeight: 600,
            whiteSpace: "normal",
            "@media (pointer: coarse)": { minHeight: 44 },
            ...(isDark && {
              "&.MuiButton-colorPrimary": {
                "--variant-textColor": theme.palette.primary.light,
                "--variant-outlinedColor": theme.palette.primary.light,
              },
              "&.MuiButton-colorError": {
                "--variant-textColor": theme.palette.error.light,
                "--variant-outlinedColor": theme.palette.error.light,
              },
              "&.MuiButton-contained.MuiButton-colorPrimary:hover:not(.Mui-disabled)": {
                color: theme.palette.text.primary,
              },
            }),
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: "none",
            minWidth: 0,
            backgroundImage: "none",
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            borderRight: `1px solid ${theme.palette.divider}`,
            backgroundImage: "none",
          }),
        },
      },
    },
  });
}

// Default light theme for static usages or backward compatibility
export const theme = getAppTheme("light");
