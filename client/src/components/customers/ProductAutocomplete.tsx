import type { Ref } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { productSelection } from "../../utils/opticalForm";

type Props<T> = {
  options: T[];
  text: string;
  catalogId: string;
  label: string;
  placeholder: string;
  productLabel: (product: T) => string;
  searchText: (product: T) => string;
  onChange: (text: string, catalogId: string) => void;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
};

export default function ProductAutocomplete<T extends { id: string }>({
  options,
  text,
  catalogId,
  label,
  placeholder,
  productLabel,
  searchText,
  onChange,
  onBlur,
  inputRef,
  disabled,
  loading,
  error,
}: Props<T>) {
  return (
    <Autocomplete<T, false, false, true>
      freeSolo
      fullWidth
      openOnFocus
      forcePopupIcon
      autoHighlight
      clearOnBlur={false}
      disabled={disabled}
      loading={loading}
      options={options}
      filterOptions={(items, state) =>
        items.filter((item) =>
          searchText(item).toLowerCase().includes(state.inputValue.toLowerCase().trim()),
        )
      }
      getOptionLabel={(option) => (typeof option === "string" ? option : productLabel(option))}
      isOptionEqualToValue={(option, value) => typeof value !== "string" && option.id === value.id}
      value={options.find((item) => item.id === catalogId) ?? text}
      inputValue={text}
      onInputChange={(_, next, reason) => {
        if (reason === "input" || reason === "clear") onChange(next, "");
      }}
      onChange={(_, selected) => {
        const next = productSelection(selected, productLabel);
        onChange(next.text, next.catalogId);
      }}
      onBlur={onBlur}
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={inputRef}
          label={label}
          placeholder={placeholder}
          error={Boolean(error)}
          helperText={error ?? (catalogId ? "Selected from catalog" : "Catalog or custom name")}
        />
      )}
    />
  );
}
