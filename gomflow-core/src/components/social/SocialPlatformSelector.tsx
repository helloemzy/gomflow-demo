'use client';

/**
 * Social Platform Selector Component
 * Displays available social media platforms for connection
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  ExternalLink, 
  Check, 
  AlertTriangle,
  Loader2
} from 'lucide-react';

interface PlatformInfo {
  id: string;
  name: string;
  displayName: string;
  color: string;
  icon: string;
  description: string;
  features: string[];
  configured: boolean;
}

interface SocialPlatformSelectorProps {
  onSelect: (platform: string) => void;
  excludePlatforms?: string[];
  filterConfigured?: boolean;
  showFeatures?: boolean;
  searchable?: boolean;
  compact?: boolean;
}

export function SocialPlatformSelector({
  onSelect,
  excludePlatforms = [],
  filterConfigured = false,
  showFeatures = true,
  searchable = true,
  compact = false,
}: SocialPlatformSelectorProps) {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  // Fetch available platforms
  const fetchPlatforms = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/social/status');
      const data = await response.json();

      if (data.success) {
        let availablePlatforms = data.data.platforms.info || [];
        
        // Filter out excluded platforms
        if (excludePlatforms.length > 0) {
          availablePlatforms = availablePlatforms.filter(
            (platform: PlatformInfo) => !excludePlatforms.includes(platform.id)
          );
        }
        
        // Filter to only configured platforms if requested
        if (filterConfigured) {
          availablePlatforms = availablePlatforms.filter(
            (platform: PlatformInfo) => platform.configured
          );
        }
        
        setPlatforms(availablePlatforms);
      } else {
        throw new Error(data.error || 'Failed to fetch platforms');
      }
    } catch (err) {
      console.error('Failed to fetch platforms:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch platforms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatforms();
  }, []);

  // Filter platforms based on search term
  const filteredPlatforms = platforms.filter(platform =>
    platform.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    platform.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    platform.features.some(feature => 
      feature.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleSelect = (platform: string) => {
    setSelectedPlatform(platform);
    onSelect(platform);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading platforms...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={fetchPlatforms}
          >
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (platforms.length === 0) {
    return (
      <div className="text-center p-8">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">No Platforms Available</h3>
          <p className="text-gray-600">
            {filterConfigured 
              ? 'No platforms are properly configured. Please check your environment variables.'
              : 'All supported platforms are already connected.'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search platforms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
        {filteredPlatforms.map((platform) => (
          <Card 
            key={platform.id} 
            className={`cursor-pointer transition-all hover:shadow-md border-2 ${
              selectedPlatform === platform.id 
                ? 'border-primary' 
                : platform.configured 
                  ? 'border-gray-200 hover:border-gray-300' 
                  : 'border-red-200 bg-red-50'
            }`}
            onClick={() => platform.configured && handleSelect(platform.id)}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Platform Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold"
                      style={{ backgroundColor: platform.color }}
                    >
                      {platform.icon}
                    </div>
                    <div>
                      <h3 className="font-medium">{platform.displayName}</h3>
                      <p className="text-sm text-gray-600">@{platform.name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {platform.configured ? (
                      <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                        <Check className="w-3 h-3 mr-1" />
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Not Configured
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Platform Description */}
                <p className="text-sm text-gray-600">
                  {platform.description}
                </p>

                {/* Platform Features */}
                {showFeatures && platform.features.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                      Features
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {platform.features.slice(0, compact ? 2 : 4).map((feature) => (
                        <Badge key={feature} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                      {platform.features.length > (compact ? 2 : 4) && (
                        <Badge variant="outline" className="text-xs">
                          +{platform.features.length - (compact ? 2 : 4)} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Configuration Warning */}
                {!platform.configured && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      This platform is not properly configured. Please check your environment variables.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Connect Button */}
                {platform.configured && (
                  <Button
                    className="w-full mt-3"
                    style={{ backgroundColor: platform.color }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(platform.id);
                    }}
                    disabled={selectedPlatform === platform.id}
                  >
                    {selectedPlatform === platform.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Connect {platform.displayName}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPlatforms.length === 0 && searchTerm && (
        <div className="text-center p-8">
          <div className="space-y-2">
            <h3 className="text-lg font-medium">No Results Found</h3>
            <p className="text-gray-600">
              No platforms match your search for "{searchTerm}".
            </p>
            <Button
              variant="outline"
              onClick={() => setSearchTerm('')}
            >
              Clear Search
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}