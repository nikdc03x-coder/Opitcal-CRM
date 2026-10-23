import { createTheme } from "@mui/material/styles";

// Central theme for the entire Optical CRM.
// Changing colors here updates every Material UI page.
export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#2563EB",
    },
    background: {
      default: "#F5F7FB",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#17243B",
      secondary: "#64748B",
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
      styleOverrides: {
        html: { minWidth: 0, scrollPaddingTop: 80 },
        body: { minWidth: 0 },
        "#root": { width: "100%", minWidth: 0, minHeight: "100dvh" },
        "img, svg": { maxWidth: "100%" },
      },
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
    MuiTypography: { styleOverrides: { root: { overflowWrap: "anywhere" } } },
    MuiFormControl: { styleOverrides: { root: { minWidth: 0, maxWidth: "100%" } } },
    MuiFormHelperText: { styleOverrides: { root: { overflowWrap: "anywhere" } } },
    MuiAlert: {
      styleOverrides: { root: { minWidth: 0 }, message: { minWidth: 0, overflowWrap: "anywhere" } },
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
    MuiTab: { styleOverrides: { root: { minHeight: 44 } } },
    MuiPaginationItem: {
      styleOverrides: { root: { "@media (pointer: coarse)": { minWidth: 44, height: 44 } } },
    },
    MuiToggleButtonGroup: { styleOverrides: { root: { flexWrap: "wrap", maxWidth: "100%" } } },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          whiteSpace: "normal",
          minHeight: 40,
          "@media (pointer: coarse)": { minHeight: 44 },
        },
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
        root: {
          textTransform: "none",
          borderRadius: 10,
          fontWeight: 600,
          whiteSpace: "normal",
          "@media (pointer: coarse)": { minHeight: 44 },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #E7EBF2",
          boxShadow: "none",
          minWidth: 0,
        },
      },
    },
  },
});
