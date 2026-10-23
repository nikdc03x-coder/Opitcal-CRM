import { Dialog, useMediaQuery, useTheme, type DialogProps } from "@mui/material";

/** Long forms use the available screen on phones and retain a dialog on desktop. */
export default function ResponsiveDialog(props: DialogProps) {
  const theme = useTheme();
  const smallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  return <Dialog scroll="paper" {...props} fullScreen={smallScreen || props.fullScreen} />;
}
