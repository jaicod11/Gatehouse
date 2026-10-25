import { Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, TextInput, View, type TextStyle } from 'react-native';

import { colors } from '@/constants/theme';
import { cn } from '@/utils/cn';

export type SearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Read by screen readers; defaults to the placeholder. */
  label?: string;
  className?: string;
};

/** Text field with a search icon and a clear button. */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  label,
  className,
}: SearchFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      className={cn(
        'h-12 flex-row items-center gap-2.5 rounded-control border bg-white/[0.04] px-3.5',
        focused ? 'border-accent-violet/60' : 'border-border-strong',
        className,
      )}
    >
      <Search size={18} color={focused ? colors.text.secondary : colors.text.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        accessibilityLabel={label ?? placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="h-full flex-1 py-0 font-sans text-[15px] text-fg"
        style={webInput}
      />
      {value ? (
        <Pressable
          role="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          onPress={() => onChangeText('')}
          className="rounded-md p-1 hover:bg-white/10 active:bg-white/10"
        >
          <X size={16} color={colors.text.secondary} strokeWidth={2.25} />
        </Pressable>
      ) : null}
    </View>
  );
}

// The focus ring is the border above, so drop the browser's default outline.
const webInput: TextStyle | undefined = Platform.OS === 'web' ? { outlineWidth: 0 } : undefined;
