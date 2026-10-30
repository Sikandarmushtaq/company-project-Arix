import React from 'react';
import { FiMapPin, FiHash, FiSearch, FiGlobe } from 'react-icons/fi';
import { Button, Input, Tabs, TabsList, TabsTrigger, StyledSelect } from '@/components/ui';

export type SearchTabKey = 'city' | 'area';
export type CountryCode = 'US' | 'CA';

interface NumberSearchFormProps {
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  tab: SearchTabKey;
  onTabChange: (tab: SearchTabKey) => void;
  city: string;
  onCityChange: (city: string) => void;
  areaCode: string;
  onAreaCodeChange: (areaCode: string) => void;
  digitFilter: string;
  onDigitFilterChange: (digits: string) => void;
  onSearch: () => void;
  isSearching: boolean;
}

export function NumberSearchForm({
  country,
  onCountryChange,
  tab,
  onTabChange,
  city,
  onCityChange,
  areaCode,
  onAreaCodeChange,
  digitFilter,
  onDigitFilterChange,
  onSearch,
  isSearching,
}: NumberSearchFormProps) {
  return (
    <div className="space-y-4">
      {/* Country Selection */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--muted)]/20 border border-[var(--border)]">
        <div className="flex items-center gap-2">
          <FiGlobe className="w-4 h-4 text-[var(--muted-foreground)]" />
          <span className="text-xs font-semibold text-[var(--foreground)]">Country</span>
        </div>
        <div className="w-48">
          <StyledSelect
            value={country}
            onChange={(v) => onCountryChange(v as CountryCode)}
            className="w-full text-xs"
            aria-label="Select Country"
          >
            <option value="US">United States (+1)</option>
            <option value="CA">Canada (+1)</option>
          </StyledSelect>
        </div>
      </div>

      {/* Search Mode Tabs */}
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as SearchTabKey)}>
        <TabsList variant="underline" className="w-full">
          <TabsTrigger value="city" variant="underline" className="text-xs flex-1">
            By city
          </TabsTrigger>
          <TabsTrigger value="area" variant="underline" className="text-xs flex-1">
            By area code
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Mode Inputs */}
      <div className="space-y-3">
        {tab === 'city' && (
          <Input
            label="City"
            leftIcon={<FiMapPin className="w-4 h-4" />}
            placeholder="e.g. Dallas, New York, Austin, Toronto"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
        )}

        {tab === 'area' && (
          <Input
            label="Area Code"
            leftIcon={<FiHash className="w-4 h-4" />}
            placeholder="e.g. 214, 971, 212, 416"
            value={areaCode}
            onChange={(e) => onAreaCodeChange(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
        )}

        {/* Filter by digits & Search button */}
        <div className="flex items-center gap-2">
          <Input
            hideLabel
            label="Filter by digits"
            leftIcon={<FiSearch className="w-4 h-4" />}
            placeholder="Filter by digits (e.g. 555, 1407)"
            value={digitFilter}
            onChange={(e) => onDigitFilterChange(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={onSearch}
            loading={isSearching}
            className="shrink-0 h-10 px-5 text-xs font-semibold"
          >
            Search
          </Button>
        </div>
      </div>
    </div>
  );
}
