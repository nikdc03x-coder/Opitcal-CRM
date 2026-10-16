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
  useMediaQuery,
  useTheme,
} from "@mui/material";

import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";

// Icons for order tracking and business analytics.
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import AnalyticsOutlined from "@mui/icons-material/AnalyticsOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import { logoutAdmin } from "../../services/authApi";

import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

const drawerWidth = 250;

// Keep all workspace navigation in one place.
const navigation = [
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
];

// Display the current page name in the top bar.
function getPageTitle(path: string): string {
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
      <Toolbar sx={{ gap: 1.5 }}>
        <StorefrontOutlined color="primary" />

        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Optical CRM
        </Typography>
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
        }}
      >
        Workspace
      </Typography>

      {/* Workspace navigation */}
      <List sx={{ px: 1.5 }}>
        {navigation.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            end
            onClick={() => {
              setMobileOpen(false);
            }}
            sx={{
              borderRadius: 2,
              mb: 0.5,

              // Highlight the currently selected page.
              "&.active": {
                bgcolor: "primary.main",
                color: "white",

                "& .MuiListItemIcon-root": {
                  color: "white",
                },
              },

              "&:hover": {
                bgcolor: "action.hover",
                "&.active": {
                  bgcolor: "primary.dark",
                },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>

            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
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
          width: isMobile ? 0 : drawerWidth,
          flexShrink: 0,

          "& .MuiDrawer-paper": {
            width: drawerWidth,
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
          <Toolbar sx={{ gap: 2 }}>
            {isMobile && (
              <IconButton
                aria-label="Open navigation"
                onClick={() => {
                  setMobileOpen(true);
                }}
              >
                <MenuIcon />
              </IconButton>
            )}

            {/* Current page title */}
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {pageTitle}
            </Typography>

            <Button
              startIcon={<LogoutOutlined />}
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </Toolbar>
        </AppBar>

        {/* React Router displays the selected page here. */}
        <Box
          component="main"
          sx={{
            maxWidth: 1400,
            mx: "auto",
            p: {
              xs: 2,
              sm: 3,
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
