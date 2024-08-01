export interface APISpaceXResponse {
    docs:          Doc[];
    totalDocs:     number;
    offset:        number;
    limit:         number;
    totalPages:    number;
    page:          number;
    pagingCounter: number;
    hasPrevPage:   boolean;
    hasNextPage:   boolean;
    prevPage:      null;
    nextPage:      number;
}

export interface Doc {
    fairings:              Fairings;
    links:                 Links;
    static_fire_date_utc:  null;
    static_fire_date_unix: null;
    net:                   boolean;
    window:                null;
    rocket:                string;
    success:               null;
    failures:              any[];
    details:               null;
    crew:                  any[];
    ships:                 any[];
    capsules:              any[];
    payloads:              string[];
    launchpad:             string;
    flight_number:         number;
    name:                  string;
    date_utc:              Date;
    date_unix:             number;
    date_local:            Date;
    date_precision:        string;
    upcoming:              boolean;
    cores:                 Core[];
    auto_update:           boolean;
    tbd:                   boolean;
    launch_library_id:     null;
    id:                    string;
}

export interface Core {
    core:            null;
    flight:          null;
    gridfins:        boolean | null;
    legs:            boolean | null;
    reused:          boolean | null;
    landing_attempt: null;
    landing_success: null;
    landing_type:    null;
    landpad:         null;
}

export interface Fairings {
    reused:           null;
    recovery_attempt: null;
    recovered:        null;
    ships:            any[];
}

export interface Links {
    patch:      Patch;
    reddit:     Reddit;
    flickr:     Flickr;
    presskit:   null;
    webcast:    null;
    youtube_id: null;
    article:    null;
    wikipedia:  null;
}

export interface Flickr {
    small:    any[];
    original: any[];
}

export interface Patch {
    small: null;
    large: null;
}

export interface Reddit {
    campaign: null;
    launch:   null;
    media:    null;
    recovery: null;
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toAPISpaceXResponse(json: string): APISpaceXResponse {
        return cast(JSON.parse(json), r("APISpaceXResponse"));
    }

    public static aPISpaceXResponseToJson(value: APISpaceXResponse): string {
        return JSON.stringify(uncast(value, r("APISpaceXResponse")), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "APISpaceXResponse": o([
        { json: "docs", js: "docs", typ: a(r("Doc")) },
        { json: "totalDocs", js: "totalDocs", typ: 0 },
        { json: "offset", js: "offset", typ: 0 },
        { json: "limit", js: "limit", typ: 0 },
        { json: "totalPages", js: "totalPages", typ: 0 },
        { json: "page", js: "page", typ: 0 },
        { json: "pagingCounter", js: "pagingCounter", typ: 0 },
        { json: "hasPrevPage", js: "hasPrevPage", typ: true },
        { json: "hasNextPage", js: "hasNextPage", typ: true },
        { json: "prevPage", js: "prevPage", typ: null },
        { json: "nextPage", js: "nextPage", typ: 0 },
    ], false),
    "Doc": o([
        { json: "fairings", js: "fairings", typ: r("Fairings") },
        { json: "links", js: "links", typ: r("Links") },
        { json: "static_fire_date_utc", js: "static_fire_date_utc", typ: null },
        { json: "static_fire_date_unix", js: "static_fire_date_unix", typ: null },
        { json: "net", js: "net", typ: true },
        { json: "window", js: "window", typ: null },
        { json: "rocket", js: "rocket", typ: "" },
        { json: "success", js: "success", typ: null },
        { json: "failures", js: "failures", typ: a("any") },
        { json: "details", js: "details", typ: null },
        { json: "crew", js: "crew", typ: a("any") },
        { json: "ships", js: "ships", typ: a("any") },
        { json: "capsules", js: "capsules", typ: a("any") },
        { json: "payloads", js: "payloads", typ: a("") },
        { json: "launchpad", js: "launchpad", typ: "" },
        { json: "flight_number", js: "flight_number", typ: 0 },
        { json: "name", js: "name", typ: "" },
        { json: "date_utc", js: "date_utc", typ: Date },
        { json: "date_unix", js: "date_unix", typ: 0 },
        { json: "date_local", js: "date_local", typ: Date },
        { json: "date_precision", js: "date_precision", typ: "" },
        { json: "upcoming", js: "upcoming", typ: true },
        { json: "cores", js: "cores", typ: a(r("Core")) },
        { json: "auto_update", js: "auto_update", typ: true },
        { json: "tbd", js: "tbd", typ: true },
        { json: "launch_library_id", js: "launch_library_id", typ: null },
        { json: "id", js: "id", typ: "" },
    ], false),
    "Core": o([
        { json: "core", js: "core", typ: null },
        { json: "flight", js: "flight", typ: null },
        { json: "gridfins", js: "gridfins", typ: u(true, null) },
        { json: "legs", js: "legs", typ: u(true, null) },
        { json: "reused", js: "reused", typ: u(true, null) },
        { json: "landing_attempt", js: "landing_attempt", typ: null },
        { json: "landing_success", js: "landing_success", typ: null },
        { json: "landing_type", js: "landing_type", typ: null },
        { json: "landpad", js: "landpad", typ: null },
    ], false),
    "Fairings": o([
        { json: "reused", js: "reused", typ: null },
        { json: "recovery_attempt", js: "recovery_attempt", typ: null },
        { json: "recovered", js: "recovered", typ: null },
        { json: "ships", js: "ships", typ: a("any") },
    ], false),
    "Links": o([
        { json: "patch", js: "patch", typ: r("Patch") },
        { json: "reddit", js: "reddit", typ: r("Reddit") },
        { json: "flickr", js: "flickr", typ: r("Flickr") },
        { json: "presskit", js: "presskit", typ: null },
        { json: "webcast", js: "webcast", typ: null },
        { json: "youtube_id", js: "youtube_id", typ: null },
        { json: "article", js: "article", typ: null },
        { json: "wikipedia", js: "wikipedia", typ: null },
    ], false),
    "Flickr": o([
        { json: "small", js: "small", typ: a("any") },
        { json: "original", js: "original", typ: a("any") },
    ], false),
    "Patch": o([
        { json: "small", js: "small", typ: null },
        { json: "large", js: "large", typ: null },
    ], false),
    "Reddit": o([
        { json: "campaign", js: "campaign", typ: null },
        { json: "launch", js: "launch", typ: null },
        { json: "media", js: "media", typ: null },
        { json: "recovery", js: "recovery", typ: null },
    ], false),
};
