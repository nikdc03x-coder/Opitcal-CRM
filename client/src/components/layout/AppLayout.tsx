
import { useState } from "react";

import {
  AppBar,
  Box,
  Chip,
  CssBaseline,
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

import {
  NavLink,
  Outlet,
  useLocation,
} from "react-router";

const drawerWidth = 250;

// nik - Keep navigation easy for shop staff to understand.
// Admin catalog access is only shown in local development.
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
  ...(import.meta.env.DEV
    ? [
        {
          label: "Product Catalog",
          path: "/admin/catalog",
          icon: <Inventory2Outlined />,
        },
      ]
    : []),
];

// Display clear page names in the top bar.
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

  if (path === "/admin/catalog") {
    return "Product Catalog";
  }

  if (
    path.startsWith("/customers/") &&
    path.endsWith("/edit")
  ) {
    return "Edit Customer";
  }

  if (path.startsWith("/customers/")) {
    return "Customer Details";
  }

  return "Optical CRM";
}

export default function AppLayout() {
  const theme = useTheme();

  const isMobile = useMediaQuery(
    theme.breakpoints.down("md")
  );

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const location = useLocation();

  const pageTitle = getPageTitle(
    location.pathname
  );

  // Sidebar links are shared between desktop and mobile.
  const sidebar = (
    <Box
      sx={{
        height: "100%",
        bgcolor: "background.paper",
      }}
    >
      <Toolbar sx={{ gap: 1.5 }}>
        <StorefrontOutlined color="primary" />

        <Typography
          variant="h6"
          sx={{ fontWeight: 700 }}
        >
          Optical CRM
        </Typography>
      </Toolbar>

      <Divider />

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

      <List sx={{ px: 1.5 }}>
        {navigation.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            end={item.path === "/customers"}
            onClick={() =>
              setMobileOpen(false)
            }
            sx={{
              borderRadius: 2,
              mb: 0.5,

              "&.active": {
                bgcolor: "primary.main",
                color: "white",

                "& .MuiListItemIcon-root": {
                  color: "white",
                },
              },
            }}
          >
            <ListItemIcon
              sx={{ minWidth: 40 }}
            >
              {item.icon}
            </ListItemIcon>

            <ListItemText
              primary={item.label}
            />
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
      <CssBaseline />

      {/* Mobile uses a temporary drawer.
          Desktop keeps its navigation visible. */}
      <Drawer
        variant={
          isMobile
            ? "temporary"
            : "permanent"
        }
        open={
          isMobile
            ? mobileOpen
            : true
        }
        onClose={() =>
          setMobileOpen(false)
        }
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          width: isMobile
            ? 0
            : drawerWidth,

          flexShrink: 0,

          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        {sidebar}
      </Drawer>

      {/* Main application area. */}
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
        }}
      >
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            borderBottom:
              "1px solid #E7EBF2",
          }}
        >
          <Toolbar sx={{ gap: 2 }}>
            {isMobile && (
              <IconButton
                aria-label="Open navigation"
                onClick={() =>
                  setMobileOpen(true)
                }
              >
                <MenuIcon />
              </IconButton>
            )}

            <Typography
              variant="h6"
              sx={{ flexGrow: 1 }}
            >
              {pageTitle}
            </Typography>

            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label="Demo Shop"
            />
          </Toolbar>
        </AppBar>

        {/* React Router renders the current page here. */}
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
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
