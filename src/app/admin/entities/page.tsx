"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ChevronRight } from "lucide-react";
import { DataTable } from "@/components/dashboard/DataTable";
import { usePermissionGate } from "@/hooks/usePermissionGate";
import { logger } from "@/lib/logger";

interface Entity {
  id: string;
  name: string;
  country: string;
  status: string;
  legalForm?: string;
  createdAt: string;
  registrations: Array<{ type: string; status: string }>;
}

export default function EntitiesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { can } = usePermissionGate();

  // Fetch entities
  const {
    data: entities = [],
    isLoading,
    error,
  } = useQuery<Entity[]>({
    queryKey: ["entities", searchTerm, countryFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(searchTerm && { search: searchTerm }),
        ...(countryFilter && { country: countryFilter }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`/api/entities?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch entities");
      }

      const result = await response.json();
      return result.data;
    },
    staleTime: 30000,
  });

  const handleSearch = useCallback(
    (value: string) => {
      setSearchTerm(value);
    },
    []
  );

  const columns = [
    {
      id: "name",
      header: "Business Name",
      cell: (entity: Entity) => (
        <Link
          href={`/admin/entities/${entity.id}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {entity.name}
        </Link>
      ),
    },
    {
      id: "country",
      header: "Country",
      cell: (entity: Entity) => {
        const countryMap: Record<string, string> = {
          AE: "🇦🇪 UAE",
          SA: "🇸🇦 KSA",
          EG: "🇪🇬 Egypt",
        };
        return countryMap[entity.country] || entity.country;
      },
    },
    {
      id: "legalForm",
      header: "Legal Form",
      cell: (entity: Entity) => entity.legalForm || "—",
    },
    {
      id: "status",
      header: "Status",
      cell: (entity: Entity) => {
        const statusStyles: Record<string, string> = {
          ACTIVE: "bg-green-100 text-green-800",
          PENDING: "bg-yellow-100 text-yellow-800",
          ARCHIVED: "bg-gray-100 text-gray-800",
        };
        return (
          <span
            className={`px-2 py-1 rounded text-sm font-medium ${
              statusStyles[entity.status] || "bg-gray-100 text-gray-800"
            }`}
          >
            {entity.status}
          </span>
        );
      },
    },
    {
      id: "registrations",
      header: "Registrations",
      cell: (entity: Entity) => {
        const verified = entity.registrations.filter(
          (r) => r.status === "VERIFIED"
        ).length;
        return `${verified}/${entity.registrations.length}`;
      },
    },
    {
      id: "createdAt",
      header: "Created",
      cell: (entity: Entity) => {
        const date = new Date(entity.createdAt);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: (entity: Entity) => (
        <Link href={`/admin/entities/${entity.id}`}>
          <Button variant="ghost" size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      ),
    },
  ];

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-900">
          Error Loading Entities
        </h3>
        <p className="text-red-700 mt-2">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Entities</h1>
          <p className="text-gray-500 mt-1">
            Manage companies, individuals, and organizations
          </p>
        </div>
        {can("entities:create") && (
          <Link href="/admin/entities/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Entity
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Countries</option>
          <option value="AE">UAE</option>
          <option value="SA">Saudi Arabia</option>
          <option value="EG">Egypt</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        {isLoading ? (
          "Loading entities..."
        ) : (
          <>
            Showing <strong>{entities.length}</strong> entit
            {entities.length === 1 ? "y" : "ies"}
          </>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {entities.length === 0 && !isLoading ? (
          <div className="p-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No entities found
            </h3>
            <p className="text-gray-500 mb-4">
              Start by creating a new entity or importing from CSV
            </p>
            {can("entities:create") && (
              <Link href="/admin/entities/new">
                <Button>Create First Entity</Button>
              </Link>
            )}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entities.map((entity) => (
                <tr
                  key={entity.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={`${entity.id}-${col.id}`}
                      className="px-6 py-4 text-sm text-gray-900"
                    >
                      {col.cell(entity)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
