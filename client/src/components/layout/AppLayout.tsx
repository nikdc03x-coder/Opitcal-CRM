import { useState } from "react";

import {
  AppBar,
  Alert,
  Button,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Tooltip,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftOutlined from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";

// Icons for order tracking and business analytics.
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import AnalyticsOutlined from "@mui/icons-material/AnalyticsOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import { logoutAdmin } from "../../services/authApi";

import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

const drawerWidth = 250;

// Keep all workspace navigation in one place.
const navigation = [
  { label: "Settings", path: "/settings", icon: <SettingsOutlined /> },
  { label: "Trash", path: "/trash", icon: <DeleteOutline /> },
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: <DashboardOutlined />,
  },
  {
    label: "Customers",
    path: "/customers",
    icon: <PeopleOutlined />,
  },
  {
    label: "Add Customer",
    path: "/customers/new",
    icon: <PersonAddAltOutlined />,
  },

  // Staff can track spectacle preparation and delivery.
  {
    label: "Order Tracking",
    path: "/orders",
    icon: <LocalShippingOutlined />,
  },

  { label: "Product Catalog", path: "/admin/catalog", icon: <Inventory2Outlined /> },

  // Open the existing sales analytics in its own page.
  {
    label: "Business Analytics",
    path: "/analytics",
    icon: <AnalyticsOutlined />,
  },

  // WhatsApp Customer Reminder System
  {
    label: "Eye Checkup Reminders",
    path: "/reminders",
    icon: <WhatsAppIcon />,
  },
];

// Display the current page name in the top bar.
function getPageTitle(path: string): string {
  if (path === "/settings") return "Settings";
  if (path === "/trash") return "Trash";
  if (path === "/dashboard") {
    return "Dashboard";
  }

  if (path === "/customers") {
    return "Customers";
  }

  if (path === "/customers/new") {
    return "Add Customer";
  }

  if (path === "/orders") {
    return "Order Tracking";
  }

  if (path === "/reminders") {
    return "Eye Checkup Reminders";
  }

  if (path === "/analytics") {
    return "Business Analytics";
  }

  if (path === "/admin/catalog") {
    return "Product Catalog";
  }

  if (path.startsWith("/customers/") && path.endsWith("/edit")) {
    return "Edit Customer";
  }

  if (path.startsWith("/customers/")) {
    return "Customer Details";
  }

  return "Optical CRM";
}

export default function AppLayout() {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState("");
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setAuthError("");
    try {
      await logoutAdmin();
      navigate("/login", { replace: true });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to sign out. Try again.");
    } finally {
      setSigningOut(false);
    }
  }
  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isSmallLaptop = useMediaQuery(theme.breakpoints.between("md", "lg"));
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const compact = !isMobile && (collapsed ?? isSmallLaptop);
  const navigationWidth = compact ? 72 : drawerWidth;

  const [mobileOpen, setMobileOpen] = useState(false);

  const location = useLocation();

  const pageTitle = getPageTitle(location.pathname);

  // Desktop and mobile share the same navigation.
  const sidebar = (
    <Box
      sx={{
        height: "100%",
        bgcolor: "background.paper",
      }}
    >
      {/* CRM logo and name */}
      <Toolbar sx={{ gap: 1.5, px: { xs: 2 }, justifyContent: compact ? "center" : "flex-start" }}>
        <StorefrontOutlined color="primary" />

        {!compact && (
          <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
            Optical CRM
          </Typography>
        )}
        {isMobile && (
          <IconButton autoFocus aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
            <CloseOutlined />
          </IconButton>
        )}
      </Toolbar>

      <Divider />

      {/* Workspace heading */}
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{
          px: 3,
          pt: 3,
          display: "block",
          ...(compact
            ? { px: 0, pt: 2, height: 16, overflow: "hidden", visibility: "hidden" }
            : {}),
        }}
      >
        Workspace
      </Typography>

      {/* Workspace navigation */}
      <List sx={{ px: 1.5 }}>
        {navigation.map((item) => (
          <Tooltip key={item.path} title={compact ? item.label : ""} placement="right" arrow>
            <ListItemButton
              component={NavLink}
              to={item.path}
              aria-label={item.label}
              selected={
                location.pathname === item.path ||
                (item.path === "/customers" &&
                  location.pathname.startsWith("/customers/") &&
                  location.pathname !== "/customers/new")
              }
              end
              onClick={() => {
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                minHeight: 44,
                px: compact ? 1 : 2,
                justifyContent: compact ? "center" : "flex-start",

                // Highlight the currently selected page.
                "&.active, &.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "white",

                  "& .MuiListItemIcon-root": {
                    color: "white",
                  },
                },

                "&:hover": {
                  bgcolor: "action.hover",
                  "&.active, &.Mui-selected": {
                    bgcolor: "primary.dark",
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: compact ? 0 : 40 }}>{item.icon}</ListItemIcon>

              {!compact && <ListItemText primary={item.label} />}
            </ListItemButton>
          </Tooltip>
        ))}
      </List>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100dvh",
        width: "100%",
      }}
    >
      {/* Mobile drawer; permanent sidebar on desktop. */}
      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={isMobile ? mobileOpen : true}
        onClose={() => {
          setMobileOpen(false);
        }}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          width: isMobile ? 0 : navigationWidth,
          flexShrink: 0,

          "& .MuiDrawer-paper": {
            width: isMobile ? drawerWidth : navigationWidth,
            maxWidth: "calc(100vw - 32px)",
            overflowX: "hidden",
            boxSizing: "border-box",
          },
        }}
      >
        {sidebar}
      </Drawer>

      {/* Main application content */}
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
        }}
      >
        {/* Top navigation bar */}
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            borderBottom: "1px solid #E7EBF2",
          }}
        >
          <Toolbar sx={{ gap: { xs: 0.75, sm: 2 }, px: { xs: 1, sm: 2 }, minWidth: 0 }}>
            <IconButton
              aria-label={
                isMobile ? "Open navigation" : compact ? "Expand navigation" : "Collapse navigation"
              }
              aria-expanded={isMobile ? mobileOpen : !compact}
              onClick={(e) => {
                if (isMobile) {
                  e.currentTarget.blur();
                  setMobileOpen(true);
                } else {
                  setCollapsed(!compact);
                }
              }}
            >
              {isMobile ? (
                <MenuIcon />
              ) : compact ? (
                <ChevronRightOutlined />
              ) : (
                <ChevronLeftOutlined />
              )}
            </IconButton>

            {/* Current page title */}
            <Typography
              variant="h6"
              sx={{
                flexGrow: 1,
                minWidth: 0,
                fontSize: { xs: "0.95rem", sm: "1.15rem" },
                overflowWrap: "anywhere",
              }}
            >
              {pageTitle}
            </Typography>

            <Button
              startIcon={<LogoutOutlined />}
              disabled={signingOut}
              onClick={() => void signOut()}
              sx={{
                flexShrink: 0,
                minWidth: 0,
                px: { xs: 1, sm: 2 },
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
              }}
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </Toolbar>
        </AppBar>

        {/* React Router displays the selected page here. */}
        <Box
          component="main"
          id="main-content"
          sx={{
            width: "100%",
            minWidth: 0,
            maxWidth: 1600,
            mx: "auto",
            p: {
              xs: 1.5,
              sm: 2.5,
              lg: 4,
            },
          }}
        >
          {authError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {authError}
            </Alert>
          )}
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
