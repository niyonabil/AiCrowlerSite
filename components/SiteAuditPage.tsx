import React, { useState, useEffect } from 'react';
import { UserProfile, Property, AuditResultCache } from '../types';
import { PropertySelector } from './PropertySelector';
import { Auditor } from './Auditor';
import { supabase } from '../services/supabase';

export const SiteAuditPage: React.FC<{ user: UserProfile }> = ({ user }) => {
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
    const [properties, setProperties] = useState<Property[]>([]);
    const [cachedResults, setCachedResults] = useState<AuditResultCache | null>(null);
    const [isLoadingProperties, setIsLoadingProperties] = useState(true);

    useEffect(() => {
        const fetchProperties = async () => {
            setIsLoadingProperties(true);
            const { data, error } = await supabase
                .from('properties')
                .select('*')
                .eq('user_id', user.id);
            
            if (error) {
                console.error("Error fetching properties:", error);
            } else if (data) {
                setProperties(data);
            }
            setIsLoadingProperties(false);
        };
        fetchProperties();
    }, [user.id]);

    useEffect(() => {
        const fetchLatestAudit = async () => {
            if (!selectedProperty?.id) {
                setCachedResults(null);
                return;
            }
            const { data, error } = await supabase
                .from('audit_results')
                .select('*')
                .eq('property_id', selectedProperty.id)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching latest audit:', error);
            }
            setCachedResults(data as AuditResultCache | null);
        };
        fetchLatestAudit();
    }, [selectedProperty]);

    const handleAddProperties = async (urls: string[]) => {
        const existingUrls = new Set(properties.map(p => p.url));
        const newProperties = urls
            .map(url => url.startsWith('sc-domain:') ? `https://${url.substring(10)}` : url)
            .filter(url => url.startsWith('http') && !existingUrls.has(url))
            .map(url => ({ user_id: user.id, url }));

        if (newProperties.length > 0) {
            const { data, error } = await supabase.from('properties').insert(newProperties).select();
            if (error) {
                console.error("Error adding properties:", error);
            } else if (data) {
                setProperties(prev => [...prev, ...data]);
            }
        }
    };

    const handleSelectProperty = (property: Property) => {
        setSelectedProperty(property);
    };

    const handleBackToProperties = () => {
        setSelectedProperty(null);
    };
    
    const handleSaveAuditResults = async (propertyId: number, results: Omit<AuditResultCache, 'property_id' | 'id'>) => {
        const { data, error } = await supabase
            .from('audit_results')
            .insert({ ...results, property_id: propertyId })
            .select()
            .single();

        if (error) {
            console.error("Failed to save audit results:", error);
        } else if (data) {
            // After saving, set the new result as the current cached/viewed one
            setCachedResults(data as AuditResultCache);
        }
    };

    if (isLoadingProperties) {
        return <div>Loading properties...</div>;
    }

    if (!selectedProperty) {
        return (
            <PropertySelector
                properties={properties || []}
                user={user}
                onAddProperties={handleAddProperties}
                onSelectProperty={handleSelectProperty}
            />
        );
    }

    return (
        <Auditor
            key={selectedProperty.id}
            user={user}
            property={selectedProperty}
            onBack={handleBackToProperties}
            onSaveResults={handleSaveAuditResults}
            cachedResults={cachedResults}
        />
    );
};