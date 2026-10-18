import { Link } from "react-router-dom";
import { imageUrl } from "../api/imageUrl";

export default function PropertyCard({ property }) {
  return (
    <Link to={`/property/${property._id}`} className="card">
      <img src={imageUrl(property.images?.[0])} alt={property.title} />
      <div className="card-body">
        <h3>{property.title}</h3>
        <p className="muted">{property.location} - {property.type}</p>
        <p className="muted">{property.reviewCount ? `★ ${property.ratingAverage} (${property.reviewCount} reviews)` : "New listing"}</p>
        <p><strong>₹{property.price}</strong> / night</p>
      </div>
    </Link>
  );
}
